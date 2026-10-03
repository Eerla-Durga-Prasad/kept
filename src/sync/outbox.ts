import { db } from '../db/database';
import { OutboxOperation, OutboxOperationType } from './types';

/**
 * Generates standard UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Enqueue an operation into the Dexie outbox
 */
export async function enqueueOutboxOperation(
  entityType: OutboxOperation['entity_type'],
  entityId: string,
  operationType: OutboxOperationType,
  payload: Record<string, unknown>,
  clientId: string
): Promise<OutboxOperation> {
  // Idempotency / Deduplication check:
  // If an identical pending operation exists for the same entity, coalesce or update payload
  const existingPending = await db.outbox_operations
    .where('entity_id')
    .equals(entityId)
    .filter((op) => op.status === 'pending' && op.entity_type === entityType)
    .first();

  if (existingPending) {
    // If pending INSERT followed by UPDATE, preserve INSERT type with merged payload
    const effectiveOpType = existingPending.operation_type === 'INSERT' ? 'INSERT' : operationType;
    const mergedPayload = { ...existingPending.payload, ...payload };

    const updatedOp: OutboxOperation = {
      ...existingPending,
      operation_type: effectiveOpType,
      payload: mergedPayload,
      created_at: new Date().toISOString(),
    };
    await db.outbox_operations.put(updatedOp);
    return updatedOp;
  }

  const op: OutboxOperation = {
    id: generateUUID(),
    entity_type: entityType,
    entity_id: entityId,
    operation_type: operationType,
    payload,
    client_id: clientId,
    created_at: new Date().toISOString(),
    status: 'pending',
    retry_count: 0,
  };

  await db.outbox_operations.add(op);
  return op;
}

export async function getPendingOperations(): Promise<OutboxOperation[]> {
  return await db.outbox_operations
    .where('status')
    .equals('pending')
    .sortBy('created_at');
}

export async function markOperationInFlight(id: string): Promise<void> {
  await db.outbox_operations.update(id, { status: 'in_flight' });
}

export async function markOperationFailed(id: string, errorMsg: string): Promise<void> {
  const op = await db.outbox_operations.get(id);
  if (op) {
    await db.outbox_operations.update(id, {
      status: 'failed',
      retry_count: op.retry_count + 1,
      last_error: errorMsg,
    });
  }
}

export async function removeCompletedOperation(id: string): Promise<void> {
  await db.outbox_operations.delete(id);
}

export async function resetFailedOperations(): Promise<number> {
  const failedOps = await db.outbox_operations.where('status').equals('failed').toArray();
  for (const op of failedOps) {
    await db.outbox_operations.update(op.id, { status: 'pending' });
  }
  return failedOps.length;
}

export async function clearAllOutboxOperations(): Promise<void> {
  await db.outbox_operations.clear();
}
