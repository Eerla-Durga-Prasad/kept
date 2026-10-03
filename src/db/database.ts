import Dexie, { type Table } from 'dexie';
import {
  Item,
  Household,
  HouseholdMember,
  GroceryList,
  Recipe,
  Meal,
  OutboxOperation,
} from '../sync/types';

export class KeptDatabase extends Dexie {
  households!: Table<Household, string>;
  household_members!: Table<HouseholdMember, string>;
  lists!: Table<GroceryList, string>;
  items!: Table<Item, string>;
  recipes!: Table<Recipe, string>;
  meals!: Table<Meal, string>;
  outbox_operations!: Table<OutboxOperation, string>;

  constructor() {
    super('KeptOfflineDB');
    this.version(1).stores({
      households: 'id, created_at',
      household_members: 'id, household_id, user_id',
      lists: 'id, household_id',
      items: 'id, household_id, list_id, category, checked, updated_at, deleted_at, sync_status',
      recipes: 'id, household_id, category',
      meals: 'id, household_id, week_start, day_of_week, meal_type',
      outbox_operations: 'id, entity_type, entity_id, status, created_at',
    });
  }
}

export const db = new KeptDatabase();
