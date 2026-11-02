-- Migration: 20260901_initial_schema.sql
-- Description: Core Schema for Kept (Households, Members, Lists, Items, Recipes, Meals)
-- Prerequisite for: 20261010_household_invitations.sql

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Households Table
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Household Members Table
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Owner', 'Member')),
  avatar_url TEXT,
  initials TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_household_members_household_user UNIQUE (household_id, user_id)
);

-- 4. Grocery Lists Table
CREATE TABLE IF NOT EXISTS lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main Kitchen List',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Items Table (with field-level metadata for deterministic sync)
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

-- 6. Recipes Table
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
  calories_per_serving INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Meals Table (Meal Planner)
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
  servings INT DEFAULT 1,
  calories_per_serving INT,
  date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Indexes for Foreign Keys & Performance
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_lists_household_id ON lists(household_id);
CREATE INDEX IF NOT EXISTS idx_items_household_id ON items(household_id);
CREATE INDEX IF NOT EXISTS idx_items_list_id ON items(list_id);
CREATE INDEX IF NOT EXISTS idx_recipes_household_id ON recipes(household_id);
CREATE INDEX IF NOT EXISTS idx_meals_household_id ON meals(household_id);
CREATE INDEX IF NOT EXISTS idx_meals_week_start ON meals(week_start);

-- 9. Helper Security Functions (Avoid Infinite RLS Recursion)
CREATE OR REPLACE FUNCTION public.is_household_member(lookup_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = lookup_household_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_household_owner(lookup_household_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = lookup_household_id
      AND user_id = auth.uid()
      AND role = 'Owner'
  );
$$;

-- 10. Enable Row Level Security (RLS)
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

-- 11. Idempotent RLS Policies

-- Households Policies
DROP POLICY IF EXISTS "Members can view their households" ON households;
CREATE POLICY "Members can view their households"
  ON households FOR SELECT
  USING (is_household_member(id));

DROP POLICY IF EXISTS "Users can create households" ON households;
CREATE POLICY "Users can create households"
  ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners can update households" ON households;
CREATE POLICY "Owners can update households"
  ON households FOR UPDATE
  USING (is_household_owner(id))
  WITH CHECK (is_household_owner(id));

-- Household Members Policies
DROP POLICY IF EXISTS "Members can view household members" ON household_members;
CREATE POLICY "Members can view household members"
  ON household_members FOR SELECT
  USING (user_id = auth.uid() OR is_household_member(household_id));

DROP POLICY IF EXISTS "Users can insert their own membership or owners can add members" ON household_members;
CREATE POLICY "Users can insert their own membership or owners can add members"
  ON household_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR is_household_owner(household_id)));

DROP POLICY IF EXISTS "Members can update their own profile or owner can update" ON household_members;
CREATE POLICY "Members can update their own profile or owner can update"
  ON household_members FOR UPDATE
  USING (user_id = auth.uid() OR is_household_owner(household_id))
  WITH CHECK (user_id = auth.uid() OR is_household_owner(household_id));

DROP POLICY IF EXISTS "Owners can remove members or users can leave" ON household_members;
CREATE POLICY "Owners can remove members or users can leave"
  ON household_members FOR DELETE
  USING (user_id = auth.uid() OR is_household_owner(household_id));

-- Grocery Lists Policies
DROP POLICY IF EXISTS "Household members can view lists" ON lists;
CREATE POLICY "Household members can view lists"
  ON lists FOR SELECT
  USING (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can insert lists" ON lists;
CREATE POLICY "Household members can insert lists"
  ON lists FOR INSERT
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can update lists" ON lists;
CREATE POLICY "Household members can update lists"
  ON lists FOR UPDATE
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can delete lists" ON lists;
CREATE POLICY "Household members can delete lists"
  ON lists FOR DELETE
  USING (is_household_member(household_id));

-- Items Policies
DROP POLICY IF EXISTS "Household members can view items" ON items;
CREATE POLICY "Household members can view items"
  ON items FOR SELECT
  USING (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can insert items" ON items;
CREATE POLICY "Household members can insert items"
  ON items FOR INSERT
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can update items" ON items;
CREATE POLICY "Household members can update items"
  ON items FOR UPDATE
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can delete items" ON items;
CREATE POLICY "Household members can delete items"
  ON items FOR DELETE
  USING (is_household_member(household_id));

-- Recipes Policies
DROP POLICY IF EXISTS "Household members can view recipes" ON recipes;
CREATE POLICY "Household members can view recipes"
  ON recipes FOR SELECT
  USING (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can insert recipes" ON recipes;
CREATE POLICY "Household members can insert recipes"
  ON recipes FOR INSERT
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can update recipes" ON recipes;
CREATE POLICY "Household members can update recipes"
  ON recipes FOR UPDATE
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can delete recipes" ON recipes;
CREATE POLICY "Household members can delete recipes"
  ON recipes FOR DELETE
  USING (is_household_member(household_id));

-- Meals Policies
DROP POLICY IF EXISTS "Household members can view meals" ON meals;
CREATE POLICY "Household members can view meals"
  ON meals FOR SELECT
  USING (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can insert meals" ON meals;
CREATE POLICY "Household members can insert meals"
  ON meals FOR INSERT
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can update meals" ON meals;
CREATE POLICY "Household members can update meals"
  ON meals FOR UPDATE
  USING (is_household_member(household_id))
  WITH CHECK (is_household_member(household_id));

DROP POLICY IF EXISTS "Household members can delete meals" ON meals;
CREATE POLICY "Household members can delete meals"
  ON meals FOR DELETE
  USING (is_household_member(household_id));

