import React, { useState, useEffect } from 'react';
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Clock,
  Database,
  ArrowRightLeft,
  Trash2,
} from 'lucide-react';
import { syncEngine, SyncEngineStatus } from '../sync/syncEngine';
import { db } from '../db/database';
import { OutboxOperation, ConflictLogEntry, Item } from '../sync/types';
import { realtimeCoordinator } from '../sync/realtime';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncEngineStatus;
  items: Item[];
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  items,
}) => {
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [conflictLogs, setConflictLogs] = useState<ConflictLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'outbox' | 'conflicts'>('overview');
  const [simulationNote, setSimulationNote] = useState<string | null>(null);

  const loadData = async () => {
    const ops = await db.outbox_operations.toArray();
    setOperations(ops);
    setConflictLogs(syncEngine.getConflictHistory());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      const interval = setInterval(loadData, 800);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleOffline = () => {
    syncEngine.setSimulatedOffline(!syncStatus.isSimulatedOffline);
  };

  const handleFlushNow = async () => {
    await syncEngine.flushOutbox();
    await loadData();
  };

  const handleSimulateConflict = async () => {
    const bananas = items.find((i) => i.name.toLowerCase().includes('banana')) || items[0];
    if (!bananas) return;

    // Simulate Amma changing quantity on another device concurrently
    const randomQty = `${Math.floor(Math.random() * 8) + 4} pieces`;
    await realtimeCoordinator.simulateHouseholdMemberUpdate(bananas, 'Amma', {
      quantity: randomQty,
    });

    setSimulationNote(`Amma updated ${bananas.name} to "${randomQty}" concurrently! Field merge executed.`);
    setTimeout(() => setSimulationNote(null), 4000);
    await loadData();
  };

  const handleClearOutbox = async () => {
    await db.outbox_operations.clear();
    await loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-cream-50 rounded-2xl border border-borderWarm shadow-float overflow-hidden z-10 flex flex-col max-h-[90vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-borderWarm bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center text-ink-700">
              <Database className="w-5 h-5 text-terracotta-500" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-medium tracking-tight text-ink-900">
                Sync Status
              </h2>
              <p className="text-xs text-ink-500 break-normal">
                Offline-first architecture with Dexie.js + Supabase Realtime
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-borderWarm bg-cream-100/50 px-6 gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-terracotta-500 text-terracotta-600 font-semibold'
                : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('outbox')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'outbox'
                ? 'border-terracotta-500 text-terracotta-600 font-semibold'
                : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            Outbox Queue
            {operations.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-terracotta-500 text-white text-[10px]">
                {operations.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('conflicts')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'conflicts'
                ? 'border-terracotta-500 text-terracotta-600 font-semibold'
                : 'border-transparent text-ink-500 hover:text-ink-800'
            }`}
          >
            Conflict Resolver
            {conflictLogs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-botanical-600 text-white text-[10px]">
                {conflictLogs.length}
              </span>
            )}
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {simulationNote && (
            <div className="p-3 bg-botanical-50 border border-botanical-200 rounded-lg text-xs text-botanical-800 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-botanical-600 shrink-0" />
              <span>{simulationNote}</span>
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              {/* Core Hero Trust Card */}
              <div className="bg-white rounded-xl border border-borderWarm p-5 shadow-card space-y-3">
                <div className="flex items-center gap-2.5 text-botanical-700">
                  <CheckCircle2 className="w-5 h-5 text-botanical-600" />
                  <h3 className="font-serif text-lg font-medium text-ink-900">
                    Everything saved locally
                  </h3>
                </div>
                <p className="text-sm text-ink-600 leading-relaxed">
                  You can keep using Kept even without internet. We'll sync automatically when you're back online.
                </p>
                <div className="pt-2 text-xs text-ink-400 flex items-center gap-4">
                  <span>Client ID: <span className="font-mono text-ink-600">{syncEngine.getClientId()}</span></span>
                  <span>Active user: <span className="font-medium text-ink-800">Durga Prasad</span></span>
                </div>
              </div>

              {/* Three Visual State Definitions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Synced */}
                <div className="bg-white rounded-xl border border-borderWarm p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-botanical-600" />
                    <span className="text-sm font-semibold text-botanical-800">
                      Synced
                    </span>
                  </div>
                  <p className="text-xs text-ink-600">
                    Item is saved on all devices.
                  </p>
                </div>

                {/* Pending */}
                <div className="bg-white rounded-xl border border-borderWarm p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-terracotta-500 animate-pulse" />
                    <span className="text-sm font-semibold text-terracotta-700">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-ink-600">
                    Waiting to sync...
                  </p>
                </div>

                {/* Offline */}
                <div className="bg-white rounded-xl border border-borderWarm p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-ink-400" />
                    <span className="text-sm font-semibold text-ink-700">
                      Offline
                    </span>
                  </div>
                  <p className="text-xs text-ink-600">
                    Saved locally (no internet).
                  </p>
                </div>
              </div>

              {/* Interactive Simulation Controls */}
              <div className="bg-cream-100 rounded-xl border border-borderWarm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                      Architecture & Testing Controls
                    </span>
                    <p className="text-xs text-ink-500">
                      Test offline outbox buffering and concurrent multi-device sync
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cream-300 text-ink-700">
                    Portfolio Interactive Sandbox
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleToggleOffline}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 transition-colors ${
                      syncStatus.isSimulatedOffline
                        ? 'bg-amber-100 border-amber-300 text-amber-900'
                        : 'bg-white border-borderWarm hover:bg-cream-200 text-ink-800'
                    }`}
                  >
                    {syncStatus.isSimulatedOffline ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-amber-700" />
                        <span>Simulated Offline: ON</span>
                      </>
                    ) : (
                      <>
                        <Wifi className="w-3.5 h-3.5 text-botanical-600" />
                        <span>Simulate Offline Mode</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleFlushNow}
                    disabled={syncStatus.isSyncing || syncStatus.isSimulatedOffline}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white flex items-center gap-2 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync Outbox Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateConflict}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-borderWarm hover:border-botanical-500 text-ink-800 flex items-center gap-2 transition-colors"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-botanical-600" />
                    <span>Simulate Concurrent Edit (Amma)</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'outbox' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-ink-900">
                    Local Outbox Operations ({operations.length})
                  </h4>
                  <p className="text-xs text-ink-500">
                    Buffered in IndexedDB table <code>outbox_operations</code> until network flush
                  </p>
                </div>
                {operations.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearOutbox}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1.5 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear queue
                  </button>
                )}
              </div>

              {operations.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-400 bg-white rounded-xl border border-borderWarm p-6">
                  Outbox is completely clear. All local operations have been synchronized to cloud!
                </div>
              ) : (
                <div className="space-y-2">
                  {operations.map((op) => (
                    <div
                      key={op.id}
                      className="bg-white rounded-lg border border-borderWarm p-3 text-xs space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded bg-cream-200 text-ink-800 font-semibold">
                          {op.operation_type} {op.entity_type}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          op.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : op.status === 'in_flight'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {op.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-ink-500 truncate">
                        ID: {op.entity_id} • Created: {new Date(op.created_at).toLocaleTimeString()}
                      </div>
                      <pre className="text-[10px] bg-cream-100 p-2 rounded overflow-x-auto text-ink-800">
                        {JSON.stringify(op.payload, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conflicts' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-ink-900">
                  Field-Level Merge Log ({conflictLogs.length})
                </h4>
                <p className="text-xs text-ink-500">
                  Kept does NOT use whole-row last-write-wins. Each field is resolved independently with deterministic tiebreakers.
                </p>
              </div>

              {conflictLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-400 bg-white rounded-xl border border-borderWarm p-6">
                  No conflicts recorded yet. Click "Simulate Concurrent Edit" to observe a field merge!
                </div>
              ) : (
                <div className="space-y-2">
                  {conflictLogs.map((log, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg border border-borderWarm p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-semibold text-ink-900">
                          Field: {log.field}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-botanical-100 text-botanical-800 font-semibold">
                          Winner: {log.winner}
                        </span>
                      </div>
                      <div className="text-xs text-ink-600">
                        {log.reason}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                        <div className="p-1.5 bg-cream-100 rounded">
                          <span className="text-ink-400 block text-[10px]">Local value:</span>
                          {JSON.stringify(log.localValue)}
                        </div>
                        <div className="p-1.5 bg-cream-100 rounded">
                          <span className="text-ink-400 block text-[10px]">Remote value:</span>
                          {JSON.stringify(log.remoteValue)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-borderWarm bg-white/70 flex items-center justify-between text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last sync: {syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString() : 'Just now'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cream-200 hover:bg-cream-300 text-ink-900 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
