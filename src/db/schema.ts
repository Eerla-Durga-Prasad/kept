// Database schema contracts and Supabase Postgres SQL definitions for Kept

export const SUPABASE_SQL_SCHEMA = `
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Households table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Household Members table
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Member')),
  avatar_url TEXT,
  initials TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grocery Lists table
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Kitchen List',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table with field-level metadata
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL,
  category TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  field_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prep_time TEXT NOT NULL,
  serves TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  category TEXT NOT NULL,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meals planner table
CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Household Invitations table
CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Member' CHECK (role IN ('Member', 'Owner')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID
);

-- Enable Row Level Security (RLS)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

-- Household Member Isolation RLS Policy Examples:
CREATE POLICY "Household members can view items"
  ON items FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Household members can insert/update items"
  ON items FOR ALL
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Household Invitations RLS Policies
CREATE POLICY "Household members can view invitations"
  ON household_invitations FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Household owners can insert invitations"
  ON household_invitations FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'Owner'
    )
  );

CREATE POLICY "Household owners can update invitations"
  ON household_invitations FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'Owner'
    )
  );

-- Security Definer RPC: create_household_invitation
CREATE OR REPLACE FUNCTION create_household_invitation(
  p_household_id UUID,
  p_token_hash TEXT,
  p_role TEXT DEFAULT 'Member',
  p_expires_in_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_role TEXT;
  v_invitation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_inviter_role
  FROM household_members
  WHERE household_id = p_household_id AND user_id = auth.uid();

  IF v_inviter_role IS NULL OR v_inviter_role <> 'Owner' THEN
    RAISE EXCEPTION 'Only household owners can generate invitations';
  END IF;

  IF p_role <> 'Member' AND p_role <> 'Owner' THEN
    p_role := 'Member';
  END IF;

  v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  INSERT INTO household_invitations (
    household_id,
    inviter_id,
    token_hash,
    role,
    status,
    expires_at
  ) VALUES (
    p_household_id,
    auth.uid(),
    p_token_hash,
    p_role,
    'pending',
    v_expires_at
  )
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'id', v_invitation_id,
    'household_id', p_household_id,
    'expires_at', v_expires_at,
    'status', 'pending'
  );
END;
$$;

-- Security Definer RPC: get_invitation_info (Token validation for invitee screen)
CREATE OR REPLACE FUNCTION get_invitation_info(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_household RECORD;
  v_inviter RECORD;
BEGIN
  SELECT * INTO v_inv
  FROM household_invitations
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'reason', v_inv.status);
  END IF;

  IF v_inv.expires_at <= NOW() THEN
    UPDATE household_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  SELECT name INTO v_household FROM households WHERE id = v_inv.household_id;
  SELECT name INTO v_inviter FROM household_members WHERE user_id = v_inv.inviter_id AND household_id = v_inv.household_id LIMIT 1;

  RETURN jsonb_build_object(
    'valid', true,
    'household_id', v_inv.household_id,
    'household_name', COALESCE(v_household.name, 'Household'),
    'inviter_name', COALESCE(v_inviter.name, 'Family Member'),
    'role', v_inv.role,
    'expires_at', v_inv.expires_at
  );
END;
$$;

-- Security Definer RPC: accept_household_invitation
CREATE OR REPLACE FUNCTION accept_household_invitation(
  p_token_hash TEXT,
  p_member_name TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_user_id UUID;
  v_existing_member RECORD;
  v_name TEXT;
  v_initials TEXT;
  v_household RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation';
  END IF;

  SELECT * INTO v_inv
  FROM household_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation');
  END IF;

  IF v_inv.expires_at <= NOW() THEN
    UPDATE household_invitations SET status = 'expired' WHERE id = v_inv.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  IF v_inv.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has been revoked');
  END IF;

  SELECT * INTO v_existing_member
  FROM household_members
  WHERE household_id = v_inv.household_id AND user_id = v_user_id;

  IF FOUND THEN
    SELECT name INTO v_household FROM households WHERE id = v_inv.household_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_member', true,
      'household_id', v_inv.household_id,
      'household_name', v_household.name,
      'role', v_existing_member.role
    );
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation is no longer active');
  END IF;

  v_name := TRIM(COALESCE(p_member_name, ''));
  IF v_name = '' THEN
    v_name := 'Family Member';
  END IF;

  v_initials := UPPER(SUBSTRING(v_name FROM 1 FOR 2));

  INSERT INTO household_members (
    household_id,
    user_id,
    name,
    role,
    avatar_url,
    initials,
    created_at
  ) VALUES (
    v_inv.household_id,
    v_user_id,
    v_name,
    v_inv.role,
    p_avatar_url,
    v_initials,
    NOW()
  );

  UPDATE household_invitations
  SET status = 'accepted',
      accepted_at = NOW(),
      accepted_by = v_user_id
  WHERE id = v_inv.id;

  SELECT name INTO v_household FROM households WHERE id = v_inv.household_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_member', false,
    'household_id', v_inv.household_id,
    'household_name', v_household.name,
    'role', v_inv.role
  );
END;
$$;
`;
