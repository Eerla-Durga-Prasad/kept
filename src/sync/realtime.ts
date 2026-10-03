import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { syncEngine } from './syncEngine';
import { Item } from './types';

class RealtimeCoordinator {
  private broadcastChannel: BroadcastChannel | null = null;
  private isListening: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('kept_household_realtime');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'REMOTE_ITEM_CHANGE') {
          const remoteItem = event.data.payload as Item;
          // Never directly mutate UI state; pass through the syncEngine conflict resolver
          syncEngine.handleIncomingRemoteItem(remoteItem);
        }
      };
    }
  }

  public init(): void {
    if (this.isListening) return;
    this.isListening = true;

    // Connect to Supabase Realtime if configured
    if (isSupabaseConfigured && supabase) {
      supabase
        .channel('public:items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'items' },
          (payload) => {
            if (payload.new && typeof payload.new === 'object') {
              const remoteItem = payload.new as Item;
              syncEngine.handleIncomingRemoteItem(remoteItem);
            }
          }
        )
        .subscribe();
    }
  }

  /**
   * Broadcast an update to other household tabs/devices
   */
  public broadcastItemUpdate(item: Item): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'REMOTE_ITEM_CHANGE',
        payload: item,
      });
    }
  }

  /**
   * Simulates an external household member (e.g. Amma, Nanna, Sister) making a concurrent change
   */
  public simulateHouseholdMemberUpdate(
    item: Item,
    member: 'Amma' | 'Nanna' | 'Sister',
    updates: Partial<Pick<Item, 'name' | 'quantity' | 'checked' | 'deleted_at'>>
  ): Promise<{ merged: Item; hadConflict: boolean }> {
    const now = new Date().toISOString();
    const updatedMetadata = { ...item.field_metadata };

    (Object.keys(updates) as (keyof typeof updates)[]).forEach((key) => {
      if (updates[key] !== undefined) {
        updatedMetadata[key] = {
          value: updates[key],
          updated_at: now,
          updated_by: member.toLowerCase(),
        };
      }
    });

    const simulatedRemoteItem: Item = {
      ...item,
      ...updates,
      updated_at: now,
      updated_by: member.toLowerCase(),
      field_metadata: updatedMetadata,
      sync_status: 'synced',
    };

    // Forward through the strict merge pipeline
    return syncEngine.handleIncomingRemoteItem(simulatedRemoteItem);
  }
}

export const realtimeCoordinator = new RealtimeCoordinator();
