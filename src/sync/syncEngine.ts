import { db } from '../db/database';
import { Item, SyncState, OutboxOperation, ConflictLogEntry } from './types';
import {
  getPendingOperations,
  markOperationInFlight,
  removeCompletedOperation,
  markOperationFailed,
  enqueueOutboxOperation,
  generateUUID,
} from './outbox';
import { resolveItemConflict, applyLocalItemUpdate } from './conflictResolver';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SyncEngineStatus {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  conflictHistory: ConflictLogEntry[];
}

type SyncListener = (status: SyncEngineStatus) => void;

class SyncEngine {
  private isSimulatedOffline: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private conflictHistory: ConflictLogEntry[] = [];
  private listeners: Set<SyncListener> = new Set();
  private clientId: string = `device_${Math.random().toString(36).substring(2, 9)}`;
  private currentUserId: string = 'durga_prasad';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getCurrentUserId(): string {
    return this.currentUserId;
  }

  public setCurrentUserId(userId: string): void {
    this.currentUserId = userId;
  }

  public isEffectivelyOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
    return true;
  }

  public getStatus(): SyncEngineStatus {
    return {
      isOnline: this.isEffectivelyOnline(),
      isSimulatedOffline: this.isSimulatedOffline,
      isSyncing: this.isSyncing,
      pendingCount: 0, // dynamic
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      conflictHistory: [...this.conflictHistory],
    };
  }

  public async getPendingCount(): Promise<number> {
    return await db.outbox_operations.where('status').equals('pending').count();
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private async notify(): Promise<void> {
    const pendingCount = await this.getPendingCount();
    const status: SyncEngineStatus = {
      ...this.getStatus(),
      pendingCount,
    };
    this.listeners.forEach((cb) => cb(status));
  }

  public setSimulatedOffline(offline: boolean): void {
    this.isSimulatedOffline = offline;
    this.notify();
    if (!offline) {
      this.flushOutbox();
    }
  }

  private handleNetworkChange(): void {
    this.notify();
    if (this.isEffectivelyOnline()) {
      this.flushOutbox();
    }
  }

  /**
   * User write path:
   * 1. Dexie transaction
   * 2. Update local state
   * 3. Create outbox operation
   * 4. UI immediately reflects change
   * 5. Network sync happens asynchronously
   */
  public async mutateItem(
    itemId: string,
    updates: Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'checked' | 'deleted_at'>>
  ): Promise<Item> {
    const existing = await db.items.get(itemId);
    if (!existing) {
      throw new Error(`Item ${itemId} not found in local database`);
    }

    const updatedItem = applyLocalItemUpdate(existing, updates, this.currentUserId);
    updatedItem.sync_status = this.isEffectivelyOnline() ? 'pending' : 'offline';

    // Atomic local commit: update item + add outbox record
    await db.transaction('rw', db.items, db.outbox_operations, async () => {
      await db.items.put(updatedItem);
      await enqueueOutboxOperation(
        'items',
        updatedItem.id,
        'UPDATE',
        {
          ...updates,
          updated_at: updatedItem.updated_at,
          updated_by: updatedItem.updated_by,
          field_metadata: updatedItem.field_metadata,
          deleted_at: updatedItem.deleted_at,
        },
        this.clientId
      );
    });

    this.notify();

    // Trigger async sync if online
    if (this.isEffectivelyOnline()) {
      this.flushOutbox();
    }

    return updatedItem;
  }

  /**
   * Create new item locally first
   */
  public async createItem(
    params: Omit<Item, 'id' | 'client_id' | 'created_at' | 'updated_at' | 'updated_by' | 'field_metadata' | 'sync_status'>
  ): Promise<Item> {
    const now = new Date().toISOString();
    const id = generateUUID();

    const newItem: Item = {
      ...params,
      id,
      client_id: this.clientId,
      created_at: now,
      updated_at: now,
      updated_by: this.currentUserId,
      sync_status: this.isEffectivelyOnline() ? 'pending' : 'offline',
      field_metadata: {
        name: { value: params.name, updated_at: now, updated_by: this.currentUserId },
        quantity: { value: params.quantity, updated_at: now, updated_by: this.currentUserId },
        category: { value: params.category, updated_at: now, updated_by: this.currentUserId },
        checked: { value: params.checked, updated_at: now, updated_by: this.currentUserId },
      },
    };

    await db.transaction('rw', db.items, db.outbox_operations, async () => {
      await db.items.put(newItem);
      await enqueueOutboxOperation(
        'items',
        newItem.id,
        'INSERT',
        { ...newItem },
        this.clientId
      );
    });

    this.notify();

    if (this.isEffectivelyOnline()) {
      this.flushOutbox();
    }

    return newItem;
  }

  /**
   * Flushes pending operations to remote backend or simulated cloud storage
   */
  public async flushOutbox(): Promise<void> {
    if (this.isSyncing || !this.isEffectivelyOnline()) {
      return;
    }

    this.isSyncing = true;
    this.notify();

    try {
      const operations = await getPendingOperations();

      for (const op of operations) {
        if (!this.isEffectivelyOnline()) break;

        await markOperationInFlight(op.id);

        try {
          if (isSupabaseConfigured && supabase) {
            // Real Supabase write
            await this.syncToSupabase(op);
          } else {
            // Simulated cloud network roundtrip delay
            await new Promise((resolve) => setTimeout(resolve, 150));
          }

          // Mark local item as synced if not modified again
          if (op.entity_type === 'items') {
            const currentItem = await db.items.get(op.entity_id);
            if (currentItem && currentItem.sync_status === 'pending') {
              await db.items.update(op.entity_id, { sync_status: 'synced' });
            }
          }

          await removeCompletedOperation(op.id);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.lastError = message;
          await markOperationFailed(op.id, message);
          if (op.entity_type === 'items') {
            await db.items.update(op.entity_id, { sync_status: 'failed' });
          }
        }
      }

      this.lastSyncedAt = new Date().toISOString();
      this.lastError = null;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  private async syncToSupabase(op: OutboxOperation): Promise<void> {
    if (!supabase) return;

    if (op.operation_type === 'INSERT') {
      const { error } = await supabase.from(op.entity_type).upsert(op.payload);
      if (error) throw error;
    } else if (op.operation_type === 'UPDATE') {
      const { error } = await supabase.from(op.entity_type).update(op.payload).eq('id', op.entity_id);
      if (error) throw error;
    } else if (op.operation_type === 'DELETE') {
      const { error } = await supabase.from(op.entity_type).delete().eq('id', op.entity_id);
      if (error) throw error;
    }
  }

  /**
   * Remote event handler: passes remote item through pure conflict resolution before Dexie
   */
  public async handleIncomingRemoteItem(remoteItem: Item): Promise<{ merged: Item; hadConflict: boolean }> {
    const localItem = await db.items.get(remoteItem.id);

    if (!localItem) {
      // New item from remote
      const syncedRemote = { ...remoteItem, sync_status: 'synced' as SyncState };
      await db.items.put(syncedRemote);
      this.notify();
      return { merged: syncedRemote, hadConflict: false };
    }

    // Merge through pure conflict resolver
    const { merged, hasConflicts, conflictDetails } = resolveItemConflict(localItem, remoteItem);

    if (hasConflicts) {
      this.conflictHistory = [...conflictDetails, ...this.conflictHistory].slice(0, 50);
    }

    // Retain pending status if local has unsynced outbox operations
    const pendingOutbox = await db.outbox_operations
      .where('entity_id')
      .equals(merged.id)
      .filter((op) => op.status === 'pending')
      .count();

    merged.sync_status = pendingOutbox > 0 ? 'pending' : 'synced';

    await db.items.put(merged);
    this.notify();
    return { merged, hadConflict: hasConflicts };
  }

  public getConflictHistory(): ConflictLogEntry[] {
    return this.conflictHistory;
  }

  public clearConflictHistory(): void {
    this.conflictHistory = [];
    this.notify();
  }
}

export const syncEngine = new SyncEngine();
