import React from 'react';
import {
  Monitor,
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { SyncEngineStatus } from '../sync/syncEngine';

interface TopBarProps {
  viewMode: 'desktop' | 'mobile';
  onToggleViewMode: (mode: 'desktop' | 'mobile') => void;
  syncStatus: SyncEngineStatus;
  onOpenSyncModal: () => void;
  onToggleOffline: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onToggleViewMode,
  syncStatus,
  onOpenSyncModal,
  onToggleOffline,
}) => {
  return (
    <header className="bg-cream-50/90 backdrop-blur border-b border-borderWarm px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs sticky top-0 z-30">
      {/* Left: Tagline & Brand context */}
      <div className="flex items-center gap-3">
        <span className="font-serif italic text-ink-600 hidden sm:inline">
          Good food. Shared lives.
        </span>
        <span className="text-borderWarm-dark hidden sm:inline">•</span>
        <span className="text-ink-500 font-sans text-[11px] hidden md:inline">
          Offline-first Dexie.js + Supabase Realtime
        </span>
      </div>

      {/* Right: Portfolio Switcher & Sync Controls */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        {/* Device Viewport Preview Toggle */}
        <div className="bg-cream-200/80 p-0.5 rounded-lg border border-borderWarm flex items-center">
          <button
            type="button"
            onClick={() => onToggleViewMode('desktop')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              viewMode === 'desktop'
                ? 'bg-white text-ink-900 shadow-subtle font-medium'
                : 'text-ink-500 hover:text-ink-800'
            }`}
            title="Desktop 1440px Viewport"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('mobile')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
              viewMode === 'mobile'
                ? 'bg-white text-ink-900 shadow-subtle font-medium'
                : 'text-ink-500 hover:text-ink-800'
            }`}
            title="Mobile 390px Device Preview"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile (390px)</span>
          </button>
        </div>

        {/* Quick Offline Simulation Toggle */}
        <button
          type="button"
          onClick={onToggleOffline}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors ${
            syncStatus.isSimulatedOffline
              ? 'bg-amber-100 border-amber-300 text-amber-900 font-medium'
              : 'bg-white border-borderWarm text-ink-600 hover:bg-cream-100'
          }`}
          title="Toggle simulated offline mode"
        >
          {syncStatus.isSimulatedOffline ? (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Simulated Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-botanical-600" />
              <span className="hidden sm:inline">Online</span>
            </>
          )}
        </button>

        {/* Sync Status Badge */}
        <button
          type="button"
          onClick={onOpenSyncModal}
          className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-borderWarm bg-white hover:border-terracotta-400 transition-colors text-ink-700 font-medium cursor-pointer"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              !syncStatus.isOnline
                ? 'bg-ink-400'
                : syncStatus.pendingCount > 0
                ? 'bg-terracotta-500 animate-pulse'
                : 'bg-botanical-600'
            }`}
          />
          <span className="text-[11px]">
            {!syncStatus.isOnline
              ? 'Offline'
              : syncStatus.pendingCount > 0
              ? `${syncStatus.pendingCount} Pending`
              : 'Synced'}
          </span>
          <RefreshCw
            className={`w-3 h-3 text-ink-400 ${
              syncStatus.isSyncing ? 'animate-spin' : ''
            }`}
          />
        </button>

        {/* Interactive Sandbox Helper */}
        <button
          type="button"
          onClick={onOpenSyncModal}
          className="p-1 text-terracotta-500 hover:text-terracotta-700 rounded transition-colors hidden lg:block"
          title="Open Sync Engine & Conflict Inspector"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
