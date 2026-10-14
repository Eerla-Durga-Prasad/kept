// Synchronization and Data Contract Types for Kept

export type SyncState = 'synced' | 'pending' | 'offline' | 'failed';

export type CategoryType = 'Produce' | 'Dairy' | 'Pantry' | 'Meat & Seafood' | 'Household';

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface FieldMetadata<T = unknown> {
  value: T;
  updated_at: string; // ISO 8601
  updated_by: string; // user_id or client_id
}

export type ItemFieldMetadataMap = Record<string, FieldMetadata<unknown> | undefined>;

export interface Item {
  id: string; // UUID
  household_id: string;
  list_id: string;
  client_id: string;
  name: string;
  quantity: string;
  category: CategoryType;
  checked: boolean;
  updated_at: string;
  updated_by: string;
  deleted_at: string | null;
  created_at: string;
  // Field-level metadata tracking for CRDT-like deterministic merges
  field_metadata: ItemFieldMetadataMap;
  // Local UI sync flag
  sync_status: SyncState;
}

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  name: string;
  role: 'Owner' | 'Member';
  avatar_url?: string;
  initials: string;
  created_at: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface HouseholdInvitation {
  id: string;
  household_id: string;
  inviter_id: string;
  token: string;
  token_hash: string;
  role: 'Owner' | 'Member';
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
  accepted_by?: string;
}

export interface GroceryList {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  checked?: boolean;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  prep_time: string;
  serves: string;
  difficulty: 'Easy' | 'Medium' | 'Advanced';
  description: string;
  image_url: string;
  category: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  created_at: string;
}

export interface Meal {
  id: string;
  household_id: string;
  week_start: string; // YYYY-MM-DD
  day_of_week: DayOfWeek;
  meal_type: MealType;
  recipe_id?: string;
  title: string;
  image_url: string;
  notes?: string;
  created_at: string;
  date?: string; // YYYY-MM-DD
}

export type OutboxOperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OutboxOperation {
  id: string; // UUID
  entity_type: 'items' | 'meals' | 'recipes' | 'household_members';
  entity_id: string;
  operation_type: OutboxOperationType;
  payload: Record<string, unknown>;
  client_id: string;
  created_at: string;
  status: 'pending' | 'in_flight' | 'failed';
  retry_count: number;
  last_error?: string;
}

export interface ConflictLogEntry {
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  winner: 'local' | 'remote';
  reason: string;
}

export interface MergeResult<T> {
  merged: T;
  hasConflicts: boolean;
  conflictDetails: ConflictLogEntry[];
}
