-- Migration: 20261010_household_invitations.sql
-- Household Invitation System with Security Definer RPCs and RLS

-- 1. Household Invitations table
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

-- Index for speedy token lookup and expiration maintenance
CREATE INDEX IF NOT EXISTS idx_household_invitations_token_hash ON household_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_household_invitations_household_id ON household_invitations(household_id);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE household_invitations ENABLE ROW LEVEL SECURITY;

-- Household members can view active/historical invitations for their household
CREATE POLICY "Household members can view invitations"
  ON household_invitations FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Only household Owners can create invitations
CREATE POLICY "Household owners can insert invitations"
  ON household_invitations FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'Owner'
    )
  );

-- Only household Owners can revoke or update invitations
CREATE POLICY "Household owners can update invitations"
  ON household_invitations FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'Owner'
    )
  );

-- 3. Security Definer RPC: create_household_invitation
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

-- 4. Security Definer RPC: get_invitation_info (Token validation for invitee screen)
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

-- 5. Security Definer RPC: accept_household_invitation
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

  -- Lock invitation row to prevent concurrent acceptance
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

  -- Check if already member
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
