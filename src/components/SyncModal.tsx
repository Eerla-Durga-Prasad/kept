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
  Cloud,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
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
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const loadData = async () => {
    const ops = await db.outbox_operations.toArray();
    setOperations(ops);
    setConflictLogs(syncEngine.getConflictHistory());
  };

  useEffect(() => {
    if (isOpen) {
      setShowDetails(false);
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

  const formatLastSyncTimestamp = (isoString: string | null): string => {
    if (!isoString) {
      return 'Checked just now';
    }
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Checked just now';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      if (diffMs >= 0 && diffMs < 60000) {
        return 'Just now';
      }

      const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return `Today at ${timeStr}`;
      }

      return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
    } catch {
      return 'Checked just now';
    }
  };

  // Derive genuine sync state
  const isOffline = !syncStatus.isOnline;
  const pendingOpsCount = Math.max(
    syncStatus.pendingCount,
    operations.filter((op) => op.status === 'pending' || op.status === 'in_flight').length
  );
  const isSyncing = !isOffline && (syncStatus.isSyncing || pendingOpsCount > 0);
  const isSynced = !isOffline && !isSyncing && pendingOpsCount === 0 && operations.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${
          showDetails ? 'max-w-2xl' : 'max-w-lg'
        } bg-cream-50 rounded-2xl border border-borderWarm shadow-float overflow-hidden z-10 flex flex-col max-h-[90vh] animate-fadeIn transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-borderWarm bg-white/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center text-ink-700 shrink-0">
              <Cloud className="w-5 h-5 text-terracotta-500" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-xl sm:text-2xl font-medium tracking-tight text-ink-900 truncate">
                {showDetails ? 'Sync Diagnostics' : 'Sync Status'}
              </h2>
              <p className="text-xs text-ink-500 truncate">
                {showDetails
                  ? 'Internal queues, field conflict logs, and sandbox tools'
                  : 'Device & cloud synchronization'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors cursor-pointer shrink-0 ml-2"
            aria-label="Close sync modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Normal User Clean Status View */}
        {!showDetails ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
            {/* Primary Status Panel */}
            <div className="bg-white rounded-xl border border-borderWarm p-5 sm:p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {isOffline ? (
                    <div className="w-12 h-12 rounded-full bg-sand-200/70 border border-borderWarm flex items-center justify-center text-ink-600 shrink-0">
                      <WifiOff className="w-6 h-6 text-ink-700" />
                    </div>
                  ) : isSyncing ? (
                    <div className="w-12 h-12 rounded-full bg-terracotta-50 border border-terracotta-200 flex items-center justify-center text-terracotta-500 shrink-0">
                      <RefreshCw className="w-6 h-6 animate-spin text-terracotta-500" />
                    </div>
                  ) : isSynced ? (
                    <div className="w-12 h-12 rounded-full bg-botanical-50 border border-botanical-200 flex items-center justify-center text-botanical-600 shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-botanical-600" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                      <RefreshCw className="w-6 h-6 text-amber-600" />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-400 block">
                      Connection Status
                    </span>
                    <span className="text-xs font-semibold text-ink-800">
                      {isOffline
                        ? 'Offline'
                        : isSyncing
                        ? 'Connecting & Syncing'
                        : isSynced
                        ? 'Connected'
                        : 'Pending Sync'}
                    </span>
                  </div>
                </div>

                {/* Subtle Status Pill */}
                <div
                  className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 shrink-0 ${
                    isOffline
                      ? 'bg-cream-200 text-ink-700 border border-borderWarm'
                      : isSyncing
                      ? 'bg-terracotta-50 text-terracotta-700 border border-terracotta-200'
                      : isSynced
                      ? 'bg-botanical-50 text-botanical-700 border border-botanical-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isOffline
                        ? 'bg-ink-400'
                        : isSyncing
                        ? 'bg-terracotta-500 animate-pulse'
                        : isSynced
                        ? 'bg-botanical-600'
                        : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  <span>
                    {isOffline ? 'Offline' : isSyncing ? 'Syncing' : isSynced ? 'Synced' : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Status Headline and Explanation */}
              <div className="space-y-1.5 pt-1">
                <h3 className="font-serif text-xl sm:text-2xl font-medium text-ink-900 tracking-tight">
                  {isOffline
                    ? 'Offline — changes saved on this device'
                    : isSyncing
                    ? 'Syncing…'
                    : isSynced
                    ? 'All changes synced'
                    : 'Syncing…'}
                </h3>
                <p className="text-sm text-ink-600 leading-relaxed">
                  {isOffline
                    ? 'You can continue organizing your pantry and grocery list. Everything is saved locally on this device and will sync automatically once reconnected.'
                    : isSyncing
                    ? pendingOpsCount > 0
                      ? `Uploading ${pendingOpsCount} update${pendingOpsCount === 1 ? '' : 's'} to cloud storage...`
                      : 'Uploading your changes to cloud storage...'
                    : isSynced
                    ? 'Everything is up to date and safely stored across your household.'
                    : 'Pending operations are waiting to be uploaded to cloud storage.'}
                </p>
              </div>

              {/* Timestamp & Local Storage Indicators */}
              <div className="pt-3 border-t border-borderWarm-subtle grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-ink-600">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cream-50 border border-borderWarm-subtle">
                  <Clock className="w-4 h-4 text-ink-400 shrink-0" />
                  <div className="min-w-0 truncate">
                    <span className="text-[10px] uppercase font-semibold text-ink-400 block tracking-wider truncate">
                      {syncStatus.lastSyncedAt ? 'Last synced' : 'Last checked'}
                    </span>
                    <span className="font-medium text-ink-800 truncate block">
                      {formatLastSyncTimestamp(syncStatus.lastSyncedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cream-50 border border-borderWarm-subtle">
                  <Database className="w-4 h-4 text-botanical-600 shrink-0" />
                  <div className="min-w-0 truncate">
                    <span className="text-[10px] uppercase font-semibold text-ink-400 block tracking-wider truncate">
                      Local Storage
                    </span>
                    <span className="font-medium text-ink-800 truncate block">
                      Changes saved on this device
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Diagnostics Card with "Details" Action */}
            <div className="bg-white rounded-xl border border-borderWarm p-4 shadow-card flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                  <span className="text-xs font-semibold text-ink-900 block truncate">
                    Advanced Diagnostics
                  </span>
                </div>
                <p className="text-[11px] text-ink-500 truncate">
                  Inspect technical logs, operation queues, and testing tools
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(true)}
                className="px-3 py-1.5 bg-cream-100 hover:bg-cream-200 border border-borderWarm hover:border-terracotta-400 text-terracotta-600 hover:text-terracotta-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-subtle cursor-pointer"
              >
                <span>Details</span>
                <ChevronRight className="w-3.5 h-3.5 text-terracotta-500" />
              </button>
            </div>
          </div>
        ) : (
          /* Advanced Details / Developer Diagnostics View */
          <>
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-borderWarm-subtle bg-cream-100/40">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-cream-200 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Status</span>
              </button>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cream-200 text-ink-600 border border-borderWarm">
                Developer Mode
              </span>
            </div>

            {/* Diagnostic Tabs */}
            <div className="flex border-b border-borderWarm bg-cream-100/50 px-6 gap-6 text-xs font-medium overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`py-3 border-b-2 transition-colors shrink-0 cursor-pointer ${
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
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
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
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
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

            {/* Diagnostic Body Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {simulationNote && (
                <div className="p-3 bg-botanical-50 border border-botanical-200 rounded-lg text-xs text-botanical-800 flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-botanical-600 shrink-0" />
                  <span>{simulationNote}</span>
                </div>
              )}

              {syncStatus.lastError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Last sync error: {syncStatus.lastError}</span>
                </div>
              )}

              {activeTab === 'overview' && (
                <>
                  {/* Technical Architecture Overview Card */}
                  <div className="bg-white rounded-xl border border-borderWarm p-5 shadow-card space-y-3">
                    <div className="flex items-center gap-2.5 text-botanical-700">
                      <CheckCircle2 className="w-5 h-5 text-botanical-600 shrink-0" />
                      <h3 className="font-serif text-lg font-medium text-ink-900">
                        Technical Overview & Engine Status
                      </h3>
                    </div>
                    <p className="text-sm text-ink-600 leading-relaxed">
                      Dexie.js IndexedDB local-first storage with background outbox synchronization and Supabase Realtime broadcast channels.
                    </p>
                    <div className="pt-2 text-xs text-ink-500 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-borderWarm-subtle">
                      <div>
                        Client ID: <span className="font-mono text-ink-700 font-semibold">{syncEngine.getClientId()}</span>
                      </div>
                      <div>
                        Active user: <span className="font-medium text-ink-800">Durga Prasad</span>
                      </div>
                      <div>
                        Network: <span className="font-medium text-ink-800">{syncStatus.isOnline ? 'Online' : 'Offline'}</span>
                      </div>
                      <div>
                        Queue buffered: <span className="font-medium text-ink-800">{operations.length}</span>
                      </div>
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

                  {/* Architecture & Testing Controls */}
                  <div className="bg-cream-100 rounded-xl border border-borderWarm p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
                          Architecture & Testing Controls
                        </span>
                        <p className="text-xs text-ink-500">
                          Test offline outbox buffering and concurrent multi-device sync
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cream-300 text-ink-700 shrink-0">
                        Portfolio Interactive Sandbox
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={handleToggleOffline}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 transition-colors cursor-pointer ${
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
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                        <span>Sync Outbox Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSimulateConflict}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-borderWarm hover:border-botanical-500 text-ink-800 flex items-center gap-2 transition-colors cursor-pointer"
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
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1.5 p-1 cursor-pointer"
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
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                op.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800'
                                  : op.status === 'in_flight'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
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
                            <div className="p-1.5 bg-cream-100 rounded overflow-hidden">
                              <span className="text-ink-400 block text-[10px]">Local value:</span>
                              <span className="truncate block">{JSON.stringify(log.localValue)}</span>
                            </div>
                            <div className="p-1.5 bg-cream-100 rounded overflow-hidden">
                              <span className="text-ink-400 block text-[10px]">Remote value:</span>
                              <span className="truncate block">{JSON.stringify(log.remoteValue)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-borderWarm bg-white/70 flex items-center justify-between text-xs text-ink-500">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-ink-400" />
            <span className="truncate">
              Last sync: {formatLastSyncTimestamp(syncStatus.lastSyncedAt)}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showDetails && (
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="px-3 py-2 bg-white hover:bg-cream-100 border border-borderWarm text-ink-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Back to Status
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-cream-200 hover:bg-cream-300 text-ink-900 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
