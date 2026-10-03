import React from 'react';
import { SyncState } from '../sync/types';
import { cn } from '../lib/utils';

interface SyncIndicatorProps {
  status: SyncState;
  showLabel?: boolean;
  className?: string;
  onClick?: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  status,
  showLabel = true,
  className,
  onClick,
}) => {
  const config = {
    synced: {
      dotClass: 'bg-botanical-600',
      label: 'Synced',
      textClass: 'text-botanical-700',
      title: 'Synced — Item is saved on all devices.',
    },
    pending: {
      dotClass: 'bg-terracotta-500 animate-pulse',
      label: 'Pending',
      textClass: 'text-terracotta-600',
      title: 'Pending — Waiting to sync to cloud...',
    },
    offline: {
      dotClass: 'bg-ink-400',
      label: 'Offline',
      textClass: 'text-ink-500',
      title: 'Offline — Saved locally (no internet).',
    },
    failed: {
      dotClass: 'bg-red-500',
      label: 'Sync error',
      textClass: 'text-red-600',
      title: 'Failed — Will retry automatically when reconnected.',
    },
  }[status] || {
    dotClass: 'bg-ink-400',
    label: 'Offline',
    textClass: 'text-ink-500',
    title: 'Offline',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={config.title}
      className={cn(
        'inline-flex items-center gap-1.5 transition-opacity hover:opacity-80 text-left',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full inline-block shrink-0', config.dotClass)} />
      {showLabel && (
        <span className={cn('text-[11px] font-medium tracking-tight', config.textClass)}>
          {config.label}
        </span>
      )}
    </button>
  );
};
