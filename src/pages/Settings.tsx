import React, { useState } from 'react';
import { db } from '../db/database';
import { syncEngine } from '../sync/syncEngine';
import { resetDatabaseToSeed } from '../lib/seedData';
import { isSupabaseConfigured } from '../lib/supabase';
import { HouseholdMember } from '../sync/types';
import {
  RotateCcw,
  Database,
  Cloud,
  CheckCircle2,
  UserCheck,
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
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetData = async () => {
    if (!confirm('Reset local IndexedDB back to initial reference state? All custom edits will be re-seeded.')) {
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 animate-fadeIn">
      {/* Header */}
      <div className="pb-6 mb-8 border-b border-borderWarm">
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
          Settings
        </h1>
        <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1.5 font-normal">
          Offline storage, cloud synchronization, and household identity.
        </p>
      </div>

      <div className="space-y-6">
        {/* Switch Persona for Testing Multi-User Concurrency */}
        <div className="bg-white rounded-2xl border border-borderWarm p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-terracotta-500" />
            <h2 className="font-serif text-xl font-medium text-ink-900">
              Active Member Profile (Multi-User Simulation)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal">
            Switch which household member is writing on this device. Each edit stamps the member's ID in the field-level metadata for deterministic CRDT conflict resolution.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
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
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col items-center text-center gap-2 ${
                    isSelected
                      ? 'border-terracotta-500 bg-terracotta-50 shadow-subtle'
                      : 'border-borderWarm bg-white hover:bg-cream-50'
                  }`}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt={m.name}
                      className="w-10 h-10 rounded-full object-cover border border-borderWarm"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center font-serif text-xs font-semibold">
                      {m.initials}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold text-ink-900 block">
                      {m.name}
                    </span>
                    <span className="text-[10px] text-ink-500 font-mono">
                      {m.role}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Database & Offline Storage State */}
        <div className="bg-white rounded-2xl border border-borderWarm p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-botanical-600 shrink-0" />
            <h2 className="font-serif text-xl font-medium text-ink-900 break-normal min-w-0">
              Offline IndexedDB (Dexie.js)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal">
            Kept persists all grocery items, meal plans, recipes, and outbox operations locally in browser IndexedDB before any network request occurs.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 bg-cream-50 border border-borderWarm rounded-xl min-w-0 break-normal">
              <span className="text-ink-400 block text-[10px]">Database Name</span>
              <span className="text-ink-900 font-semibold">{db.name} (v{db.verno})</span>
            </div>
            <div className="p-3 bg-cream-50 border border-borderWarm rounded-xl min-w-0 break-normal">
              <span className="text-ink-400 block text-[10px]">Client ID</span>
              <span className="text-ink-900 font-semibold truncate block">{syncEngine.getClientId()}</span>
            </div>
            <div className="p-3 bg-cream-50 border border-borderWarm rounded-xl min-w-0 break-normal">
              <span className="text-ink-400 block text-[10px]">PWA Status</span>
              <span className="text-botanical-700 font-semibold">Offline Ready</span>
            </div>
          </div>
        </div>

        {/* Cloud Sync Backend Info */}
        <div className="bg-white rounded-2xl border border-borderWarm p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-terracotta-500" />
            <h2 className="font-serif text-xl font-medium text-ink-900">
              Supabase Backend Connection
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal">
            {isSupabaseConfigured
              ? 'Connected to live Supabase Postgres database with Realtime broadcast enabled.'
              : 'Operating in High-Fidelity Local Simulation Mode. The outbox pattern, conflict resolver, and BroadcastChannel work offline-first. To connect a live Supabase instance, provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'}
          </p>

          <div className="p-3 bg-cream-50 rounded-xl border border-borderWarm text-xs text-ink-600 flex items-center justify-between">
            <span className="font-medium">Backend status:</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-botanical-700">
              <CheckCircle2 className="w-4 h-4" />
              {isSupabaseConfigured ? 'Live Supabase Connected' : 'Simulated Cloud Mode'}
            </span>
          </div>
        </div>

        {/* Database Reset Action */}
        <div className="bg-white rounded-2xl border border-borderWarm p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2.5 text-ink-800">
            <RotateCcw className="w-5 h-5 text-terracotta-500" />
            <h2 className="font-serif text-xl font-medium text-ink-900">
              Reset Demonstration Data
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-ink-600 font-normal">
            Restore initial reference state (Tomatoes, Onions, Bananas, Spinach, Paneer Butter Masala, weekly meals).
          </p>

          {resetSuccess && (
            <div className="p-3 bg-botanical-50 border border-botanical-200 rounded-lg text-xs text-botanical-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-botanical-600" />
              <span>Database successfully re-seeded to initial reference data!</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleResetData}
            disabled={isResetting}
            className="px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink-900 rounded-xl text-xs font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'Resetting...' : 'Restore Default Seed Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
