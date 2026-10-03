import { Item, ItemFieldMetadataMap, ConflictLogEntry, MergeResult, FieldMetadata } from './types';

/**
 * Pure deterministic field-level conflict resolver for Kept items.
 *
 * Rules:
 * 1. Field-level merging: independent fields updated concurrently are both preserved.
 * 2. Same-field conflict:
 *    - Compare `updated_at` (ISO 8601). Latest timestamp wins.
 *    - If timestamps are identical, tiebreak deterministically using `updated_by` (lexicographical winner).
 * 3. Soft deletes:
 *    - Handled via `deleted_at`. If either record has a higher `deleted_at` than the other's latest update,
 *      the tombstone is preserved.
 * 4. Purity: Returns a new object without mutating inputs.
 */

export function resolveFieldConflict<T>(
  field: string,
  localMeta?: FieldMetadata<T>,
  remoteMeta?: FieldMetadata<T>,
  fallbackLocalVal?: T,
  fallbackRemoteVal?: T
): { winnerMeta: FieldMetadata<T>; winnerSource: 'local' | 'remote'; log?: ConflictLogEntry } {
  // If only one side has metadata
  if (!localMeta && remoteMeta) {
    return { winnerMeta: remoteMeta, winnerSource: 'remote' };
  }
  if (localMeta && !remoteMeta) {
    return { winnerMeta: localMeta, winnerSource: 'local' };
  }

  // If neither has metadata, synthesize fallback
  if (!localMeta && !remoteMeta) {
    const synthetic: FieldMetadata<T> = {
      value: fallbackRemoteVal !== undefined ? fallbackRemoteVal : (fallbackLocalVal as T),
      updated_at: new Date(0).toISOString(),
      updated_by: 'system',
    };
    return { winnerMeta: synthetic, winnerSource: 'remote' };
  }

  // Both exist: compare timestamps
  const localTime = new Date(localMeta!.updated_at).getTime();
  const remoteTime = new Date(remoteMeta!.updated_at).getTime();

  if (remoteTime > localTime) {
    return {
      winnerMeta: remoteMeta!,
      winnerSource: 'remote',
      log: {
        field,
        localValue: localMeta!.value,
        remoteValue: remoteMeta!.value,
        winner: 'remote',
        reason: `Remote timestamp (${remoteMeta!.updated_at}) > Local (${localMeta!.updated_at})`,
      },
    };
  }

  if (localTime > remoteTime) {
    return {
      winnerMeta: localMeta!,
      winnerSource: 'local',
      log: {
        field,
        localValue: localMeta!.value,
        remoteValue: remoteMeta!.value,
        winner: 'local',
        reason: `Local timestamp (${localMeta!.updated_at}) > Remote (${remoteMeta!.updated_at})`,
      },
    };
  }

  // Exact timestamp tie: tiebreak deterministically via updated_by lexicographical order
  const cmp = remoteMeta!.updated_by.localeCompare(localMeta!.updated_by);
  if (cmp > 0) {
    return {
      winnerMeta: remoteMeta!,
      winnerSource: 'remote',
      log: {
        field,
        localValue: localMeta!.value,
        remoteValue: remoteMeta!.value,
        winner: 'remote',
        reason: `Tiebreaker: remote updated_by '${remoteMeta!.updated_by}' > local '${localMeta!.updated_by}'`,
      },
    };
  }

  // Local wins tiebreaker or identical
  return {
    winnerMeta: localMeta!,
    winnerSource: 'local',
    log: {
      field,
      localValue: localMeta!.value,
      remoteValue: remoteMeta!.value,
      winner: 'local',
      reason: `Tiebreaker: local updated_by '${localMeta!.updated_by}' >= remote '${remoteMeta!.updated_by}'`,
    },
  };
}

export function resolveItemConflict(localItem: Item, remoteItem: Item): MergeResult<Item> {
  const conflictDetails: ConflictLogEntry[] = [];
  const mergedMetadata: ItemFieldMetadataMap = {};

  // Check all fields tracked in Item
  const trackedFields: string[] = [
    'name',
    'quantity',
    'category',
    'checked',
    'deleted_at',
  ];

  const mergedItem: Item = {
    ...localItem,
    id: localItem.id || remoteItem.id,
    household_id: localItem.household_id || remoteItem.household_id,
    list_id: localItem.list_id || remoteItem.list_id,
    client_id: localItem.client_id || remoteItem.client_id,
    created_at: localItem.created_at || remoteItem.created_at,
    sync_status: 'synced',
    field_metadata: {},
  };

  let maxUpdatedAt = new Date(0).toISOString();
  let latestUpdatedBy = localItem.updated_by;

  for (const field of trackedFields) {
    const localMeta = localItem.field_metadata?.[field];
    const remoteMeta = remoteItem.field_metadata?.[field];

    const localVal = (localItem as unknown as Record<string, unknown>)[field];
    const remoteVal = (remoteItem as unknown as Record<string, unknown>)[field];

    const { winnerMeta, log } = resolveFieldConflict(
      field,
      localMeta as FieldMetadata<unknown>,
      remoteMeta as FieldMetadata<unknown>,
      localVal,
      remoteVal
    );

    // Record the winning field value
    (mergedItem as unknown as Record<string, unknown>)[field] = winnerMeta.value;
    (mergedMetadata as unknown as Record<string, unknown>)[field] = winnerMeta;

    if (log) {
      conflictDetails.push(log);
    }

    if (winnerMeta.updated_at > maxUpdatedAt) {
      maxUpdatedAt = winnerMeta.updated_at;
      latestUpdatedBy = winnerMeta.updated_by;
    }
  }

  // Soft delete resolution:
  // If remote deleted_at is set, check if it was set after local's latest modification
  if (remoteItem.deleted_at && !localItem.deleted_at) {
    if (new Date(remoteItem.deleted_at).getTime() >= new Date(localItem.updated_at).getTime()) {
      mergedItem.deleted_at = remoteItem.deleted_at;
    }
  } else if (!remoteItem.deleted_at && localItem.deleted_at) {
    if (new Date(localItem.deleted_at).getTime() >= new Date(remoteItem.updated_at).getTime()) {
      mergedItem.deleted_at = localItem.deleted_at;
    }
  } else if (remoteItem.deleted_at && localItem.deleted_at) {
    // Both deleted: latest delete timestamp
    mergedItem.deleted_at =
      new Date(remoteItem.deleted_at) > new Date(localItem.deleted_at)
        ? remoteItem.deleted_at
        : localItem.deleted_at;
  }

  mergedItem.field_metadata = mergedMetadata;
  mergedItem.updated_at = maxUpdatedAt;
  mergedItem.updated_by = latestUpdatedBy;

  return {
    merged: mergedItem,
    hasConflicts: conflictDetails.length > 0,
    conflictDetails,
  };
}

/**
 * Creates updated field metadata when a local user edits an item
 */
export function applyLocalItemUpdate(
  existingItem: Item,
  updates: Partial<Pick<Item, 'name' | 'quantity' | 'category' | 'checked' | 'deleted_at'>>,
  userId: string,
  timestamp: string = new Date().toISOString()
): Item {
  const updatedMetadata: ItemFieldMetadataMap = { ...existingItem.field_metadata };
  const updatedItem: Item = { ...existingItem, ...updates, updated_at: timestamp, updated_by: userId, sync_status: 'pending' };

  (Object.keys(updates) as (keyof typeof updates)[]).forEach((key) => {
    if (updates[key] !== undefined) {
      updatedMetadata[key] = {
        value: updates[key],
        updated_at: timestamp,
        updated_by: userId,
      };
    }
  });

  updatedItem.field_metadata = updatedMetadata;
  return updatedItem;
}
