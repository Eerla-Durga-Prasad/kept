import { describe, it, expect } from 'vitest';
import {
  resolveItemConflict,
  resolveFieldConflict,
  applyLocalItemUpdate,
} from '../sync/conflictResolver';
import { Item, FieldMetadata } from '../sync/types';

function createMockItem(overrides: Partial<Item> = {}): Item {
  const baseDate = '2026-09-22T10:00:00.000Z';
  return {
    id: 'item_test_1',
    household_id: 'h_test',
    list_id: 'l_test',
    client_id: 'client_A',
    name: 'Tomatoes',
    quantity: '6 pieces',
    category: 'Produce',
    checked: false,
    updated_at: baseDate,
    updated_by: 'durga_prasad',
    deleted_at: null,
    created_at: baseDate,
    sync_status: 'synced',
    field_metadata: {
      name: { value: 'Tomatoes', updated_at: baseDate, updated_by: 'durga_prasad' },
      quantity: { value: '6 pieces', updated_at: baseDate, updated_by: 'durga_prasad' },
      category: { value: 'Produce', updated_at: baseDate, updated_by: 'durga_prasad' },
      checked: { value: false, updated_at: baseDate, updated_by: 'durga_prasad' },
    },
    ...overrides,
  };
}

describe('Offline-First Pure Conflict Resolver (10 Required Test Scenarios)', () => {
  // Test 1: Local update
  it('1. Local update: modifies item and correctly updates field metadata', () => {
    const item = createMockItem();
    const updateTime = '2026-09-22T10:05:00.000Z';
    const updated = applyLocalItemUpdate(
      item,
      { quantity: '12 pieces' },
      'durga_prasad',
      updateTime
    );

    expect(updated.quantity).toBe('12 pieces');
    expect(updated.updated_at).toBe(updateTime);
    expect(updated.updated_by).toBe('durga_prasad');
    expect(updated.field_metadata.quantity?.value).toBe('12 pieces');
    expect(updated.field_metadata.quantity?.updated_at).toBe(updateTime);
    // Unmodified fields must remain intact
    expect(updated.name).toBe('Tomatoes');
    expect(updated.checked).toBe(false);
  });

  // Test 2: Remote update
  it('2. Remote update: newer remote item supersedes older local state', () => {
    const local = createMockItem();
    const remote = createMockItem({
      quantity: '8 pieces',
      updated_at: '2026-09-22T10:10:00.000Z',
      updated_by: 'amma',
      field_metadata: {
        ...local.field_metadata,
        quantity: { value: '8 pieces', updated_at: '2026-09-22T10:10:00.000Z', updated_by: 'amma' },
      },
    });

    const result = resolveItemConflict(local, remote);
    expect(result.merged.quantity).toBe('8 pieces');
    expect(result.merged.updated_by).toBe('amma');
    expect(result.hasConflicts).toBe(true);
  });

  // Test 3: Same-field conflict
  it('3. Same-field conflict: resolves by timestamp with latest write winning', () => {
    const local = createMockItem({
      quantity: '10 pieces',
      updated_at: '2026-09-22T10:15:00.000Z',
      updated_by: 'durga_prasad',
      field_metadata: {
        ...createMockItem().field_metadata,
        quantity: { value: '10 pieces', updated_at: '2026-09-22T10:15:00.000Z', updated_by: 'durga_prasad' },
      },
    });

    const remote = createMockItem({
      quantity: '14 pieces',
      updated_at: '2026-09-22T10:20:00.000Z', // Later timestamp
      updated_by: 'sister',
      field_metadata: {
        ...createMockItem().field_metadata,
        quantity: { value: '14 pieces', updated_at: '2026-09-22T10:20:00.000Z', updated_by: 'sister' },
      },
    });

    const result = resolveItemConflict(local, remote);
    expect(result.merged.quantity).toBe('14 pieces');
    expect(result.merged.updated_by).toBe('sister');
  });

  // Test 4: Different-field concurrent edits
  it('4. Different-field concurrent edits: Device A modifies quantity, Device B checks item -> both preserved', () => {
    // Device A edits quantity = '2 kg'
    const deviceA = createMockItem({
      quantity: '2 kg',
      checked: false,
      updated_at: '2026-09-22T10:30:00.000Z',
      updated_by: 'device_A',
      field_metadata: {
        name: { value: 'Tomatoes', updated_at: '2026-09-22T10:00:00.000Z', updated_by: 'durga_prasad' },
        quantity: { value: '2 kg', updated_at: '2026-09-22T10:30:00.000Z', updated_by: 'device_A' },
        checked: { value: false, updated_at: '2026-09-22T10:00:00.000Z', updated_by: 'durga_prasad' },
      },
    });

    // Device B edits checked = true
    const deviceB = createMockItem({
      quantity: '6 pieces',
      checked: true,
      updated_at: '2026-09-22T10:31:00.000Z',
      updated_by: 'device_B',
      field_metadata: {
        name: { value: 'Tomatoes', updated_at: '2026-09-22T10:00:00.000Z', updated_by: 'durga_prasad' },
        quantity: { value: '6 pieces', updated_at: '2026-09-22T10:00:00.000Z', updated_by: 'durga_prasad' },
        checked: { value: true, updated_at: '2026-09-22T10:31:00.000Z', updated_by: 'device_B' },
      },
    });

    const result = resolveItemConflict(deviceA, deviceB);
    // Crucial requirement: NOT whole-row LWW! Both edits must be merged!
    expect(result.merged.quantity).toBe('2 kg');
    expect(result.merged.checked).toBe(true);
  });

  // Test 5: Deleted item arriving from remote (Tombstone)
  it('5. Deleted item arriving from remote: soft delete tombstone is preserved', () => {
    const local = createMockItem({ updated_at: '2026-09-22T10:00:00.000Z' });
    const deleteTimestamp = '2026-09-22T11:00:00.000Z';
    const remote = createMockItem({
      deleted_at: deleteTimestamp,
      updated_at: deleteTimestamp,
      updated_by: 'amma',
    });

    const result = resolveItemConflict(local, remote);
    expect(result.merged.deleted_at).toBe(deleteTimestamp);
  });

  // Test 6: Remote stale update
  it('6. Remote stale update: older remote change does not overwrite newer local change', () => {
    const local = createMockItem({
      quantity: '10 pieces',
      updated_at: '2026-09-22T12:00:00.000Z', // Newer
      updated_by: 'durga_prasad',
      field_metadata: {
        quantity: { value: '10 pieces', updated_at: '2026-09-22T12:00:00.000Z', updated_by: 'durga_prasad' },
      },
    });

    const remoteStale = createMockItem({
      quantity: '2 pieces',
      updated_at: '2026-09-22T11:00:00.000Z', // Stale
      updated_by: 'remote_peer',
      field_metadata: {
        quantity: { value: '2 pieces', updated_at: '2026-09-22T11:00:00.000Z', updated_by: 'remote_peer' },
      },
    });

    const result = resolveItemConflict(local, remoteStale);
    expect(result.merged.quantity).toBe('10 pieces');
    expect(result.merged.updated_by).toBe('durga_prasad');
  });

  // Test 7: Idempotent duplicate operation
  it('7. Idempotent duplicate operation: applying the exact same update twice yields the identical state', () => {
    const initial = createMockItem();
    const updateTime = '2026-09-22T14:00:00.000Z';

    const once = applyLocalItemUpdate(initial, { checked: true }, 'nanna', updateTime);
    const twice = applyLocalItemUpdate(once, { checked: true }, 'nanna', updateTime);

    expect(once).toEqual(twice);
    const mergeIdempotent = resolveItemConflict(once, twice);
    expect(mergeIdempotent.merged.checked).toBe(true);
  });

  // Test 8: Offline queued operation
  it('8. Offline queued operation: updates maintain pending status and track modifications', () => {
    const item = createMockItem();
    const offlineItem = applyLocalItemUpdate(item, { name: 'Organic Cherry Tomatoes' }, 'offline_user');
    offlineItem.sync_status = 'offline';

    expect(offlineItem.name).toBe('Organic Cherry Tomatoes');
    expect(offlineItem.sync_status).toBe('offline');
    expect(offlineItem.field_metadata.name?.value).toBe('Organic Cherry Tomatoes');
  });

  // Test 9: Reconnect flush logic
  it('9. Reconnect flush: transitions offline queued items towards synced state with clean merge', () => {
    const offlineLocal = createMockItem({
      name: 'Roma Tomatoes',
      quantity: '4 pieces',
      sync_status: 'offline',
      updated_at: '2026-09-22T15:00:00.000Z',
      field_metadata: {
        name: { value: 'Roma Tomatoes', updated_at: '2026-09-22T15:00:00.000Z', updated_by: 'durga' },
        quantity: { value: '4 pieces', updated_at: '2026-09-22T15:00:00.000Z', updated_by: 'durga' },
      },
    });

    const remoteBaseline = createMockItem({
      updated_at: '2026-09-22T10:00:00.000Z',
    });

    const result = resolveItemConflict(offlineLocal, remoteBaseline);
    expect(result.merged.name).toBe('Roma Tomatoes');
    expect(result.merged.quantity).toBe('4 pieces');
    expect(result.merged.sync_status).toBe('synced');
  });

  // Test 10: Deterministic merge ordering
  it('10. Deterministic merge ordering: tiebreaker resolves identical timestamps deterministically across all nodes', () => {
    const identicalTimestamp = '2026-09-22T16:00:00.000Z';

    const localMeta: FieldMetadata<string> = {
      value: 'Value from Device A',
      updated_at: identicalTimestamp,
      updated_by: 'client_aaa',
    };

    const remoteMeta: FieldMetadata<string> = {
      value: 'Value from Device Z',
      updated_at: identicalTimestamp,
      updated_by: 'client_zzz',
    };

    // Device 1 evaluates (local, remote)
    const res1 = resolveFieldConflict('name', localMeta, remoteMeta);
    // Device 2 evaluates (remote, local)
    const res2 = resolveFieldConflict('name', remoteMeta, localMeta);

    // Both devices MUST arrive at the exact same winning value!
    expect(res1.winnerMeta.value).toBe('Value from Device Z');
    expect(res2.winnerMeta.value).toBe('Value from Device Z');
  });
});
