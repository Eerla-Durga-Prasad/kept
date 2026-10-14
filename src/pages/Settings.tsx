import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { syncEngine, SyncEngineStatus } from '../sync/syncEngine';
import { resetDatabaseToSeed } from '../lib/seedData';
import { isSupabaseConfigured } from '../lib/supabase';
import { HouseholdMember } from '../sync/types';
import {
  RotateCcw,
  Cloud,
  UserCheck,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  Info,
} from 'lucide-react';

interface SettingsProps {
  currentMember: HouseholdMember;
  members: HouseholdMember[];
  onSelectMember: (member: HouseholdMember) => void;
  onRefreshAllData: () => Promise<void>;
}

export const Settings: React.FC<SettingsProps> = ({
  currentMember,
  members,
  onSelectMember,
  onRefreshAllData,
}) => {
  // Preserve backend references per architectural safety guidelines
  void db;
  void isSupabaseConfigured;
  void resetDatabaseToSeed;
  void RotateCcw;

  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  void resetSuccess;
  void isResetting;

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleSyncNow = async () => {
    setIsManualSyncing(true);
    try {
      await syncEngine.flushOutbox();
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm('Reset to default sample data? Any custom items and meal plans will be replaced with the initial starter items.')) {
      return;
    }
    setIsResetting(true);
    try {
      await resetDatabaseToSeed();
      await onRefreshAllData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } finally {
      setIsResetting(false);
    }
  };
  void handleResetData;

  const formatLastSynced = (timestamp: string | null) => {
    if (!timestamp) return 'Just now';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn box-border">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-borderWarm">
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900 break-words">
          Settings
        </h1>
        <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1.5 font-normal break-words">
          Household identity, cloud synchronization, and app preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile: Active Member Selection */}
        <div className="bg-white rounded-2xl border border-borderWarm p-4 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <UserCheck className="w-5 h-5 text-terracotta-500 shrink-0" />
            <h2 className="font-serif text-lg sm:text-xl font-medium text-ink-900 break-words min-w-0">
              Active Member Profile
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal break-words">
            Select which household member is currently using this device. Updates to lists and meal plans will be attributed to this profile.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2">
            {members.map((m) => {
              const isSelected = currentMember.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelectMember(m);
                    syncEngine.setCurrentUserId(m.user_id);
                  }}
                  className={`p-2.5 sm:p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 min-w-0 w-full ${
                    isSelected
                      ? 'border-terracotta-500 bg-terracotta-50 shadow-subtle'
                      : 'border-borderWarm bg-white hover:bg-cream-50'
                  }`}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-10 h-10 rounded-full object-cover border border-borderWarm shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center font-serif text-xs font-semibold shrink-0">
                      {m.initials}
                    </div>
                  )}
                  <div className="w-full min-w-0 overflow-hidden">
                    <span className="text-xs font-semibold text-ink-900 block truncate">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-ink-500 font-mono block">
                      {m.role}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sync: Cloud Synchronization */}
        <div className="bg-white rounded-2xl border border-borderWarm p-4 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Cloud className="w-5 h-5 text-terracotta-500 shrink-0" />
            <h2 className="font-serif text-lg sm:text-xl font-medium text-ink-900 break-words min-w-0">
              Cloud Synchronization
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal break-words">
            Your pantry items, grocery lists, and meal plans stay synchronized across your household devices.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Sync Status Card */}
            <div className="p-3.5 bg-cream-50 border border-borderWarm rounded-xl flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <span className="text-ink-400 block text-[10px] uppercase tracking-wider font-medium">Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      syncStatus.isSyncing
                        ? 'bg-amber-500 animate-pulse'
                        : !syncStatus.isOnline
                        ? 'bg-ink-400'
                        : syncStatus.pendingCount > 0
                        ? 'bg-terracotta-500 animate-pulse'
                        : 'bg-botanical-600'
                    }`}
                  />
                  <span className="text-xs font-semibold text-ink-900 truncate">
                    {syncStatus.isSyncing
                      ? 'Syncing...'
                      : !syncStatus.isOnline
                      ? 'Offline (Saved Locally)'
                      : syncStatus.pendingCount > 0
                      ? `${syncStatus.pendingCount} pending update${syncStatus.pendingCount === 1 ? '' : 's'}`
                      : 'Up to Date'}
                  </span>
                </div>
              </div>
              {syncStatus.isOnline ? (
                <Wifi className="w-4 h-4 text-botanical-600 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-ink-400 shrink-0" />
              )}
            </div>

            {/* Last Synced Card */}
            <div className="p-3.5 bg-cream-50 border border-borderWarm rounded-xl flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <span className="text-ink-400 block text-[10px] uppercase tracking-wider font-medium">Last Synced</span>
                <span className="text-xs font-semibold text-ink-900 block truncate mt-0.5">
                  {formatLastSynced(syncStatus.lastSyncedAt)}
                </span>
              </div>
              <Clock className="w-4 h-4 text-ink-400 shrink-0" />
            </div>
          </div>

          <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <span className="text-xs text-ink-500">
              Automatic sync runs when changes are made.
            </span>
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isManualSyncing || syncStatus.isSyncing}
              className="w-full sm:w-auto px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink-900 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isManualSyncing || syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing || syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* About: Application Info */}
        <div className="bg-white rounded-2xl border border-borderWarm p-4 sm:p-6 shadow-card space-y-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Info className="w-5 h-5 text-terracotta-500 shrink-0" />
            <h2 className="font-serif text-lg sm:text-xl font-medium text-ink-900 break-words min-w-0">
              About Kept
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal break-words">
            Kept is a household pantry and meal planning app designed for effortless coordination and offline-first peace of mind.
          </p>
          <div className="pt-2 border-t border-borderWarm/60 flex items-center justify-between text-xs text-ink-500">
            <span>Version</span>
            <span className="font-mono font-medium text-ink-700">1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

