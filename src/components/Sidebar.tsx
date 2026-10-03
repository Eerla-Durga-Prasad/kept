import React from 'react';
import {
  Home,
  ShoppingBag,
  CalendarDays,
  BookOpen,
  Users,
  Settings,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { HouseholdMember } from '../sync/types';

export type NavTab = 'home' | 'groceries' | 'meals' | 'recipes' | 'household' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  members: HouseholdMember[];
  onInviteMember: () => void;
  onOpenSyncModal: () => void;
  isOnline: boolean;
  pendingCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  members,
  onInviteMember,
  onOpenSyncModal,
  isOnline,
  pendingCount,
}) => {
  const navItems = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'groceries' as NavTab, label: 'Groceries', icon: ShoppingBag },
    { id: 'meals' as NavTab, label: 'Meals', icon: CalendarDays },
    { id: 'recipes' as NavTab, label: 'Recipes', icon: BookOpen },
    { id: 'household' as NavTab, label: 'Household', icon: Users },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-borderWarm bg-cream-50/70 h-screen flex flex-col justify-between p-6 select-none shrink-0 sticky top-0 hidden md:flex">
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between pb-8">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onSelectTab('home')}>
            <span className="font-serif text-3xl font-semibold tracking-tight text-ink-900">
              Kept
            </span>
            {/* Elegant organic leaf detail */}
            <svg
              className="w-4 h-4 text-terracotta-500 transform -rotate-12 translate-y-[-4px]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </svg>
          </div>

          {/* Quick Sync Pill */}
          <button
            type="button"
            onClick={onOpenSyncModal}
            className="group flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-borderWarm bg-white hover:border-borderWarm-dark transition-all text-ink-500"
            title="Sync status & outbox"
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                !isOnline
                  ? 'bg-ink-400'
                  : pendingCount > 0
                  ? 'bg-terracotta-500 animate-pulse'
                  : 'bg-botanical-600'
              )}
            />
            <span className="text-[11px] font-medium text-ink-700">
              {!isOnline ? 'Offline' : pendingCount > 0 ? `${pendingCount} pending` : 'Synced'}
            </span>
            <RefreshCw className="w-2.5 h-2.5 text-ink-400 group-hover:rotate-180 transition-transform duration-300" />
          </button>
        </div>

        {/* Navigation list with thin elegant icons */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left',
                  isActive
                    ? 'bg-white text-ink-900 border border-borderWarm shadow-subtle'
                    : 'text-ink-600 hover:text-ink-900 hover:bg-cream-200/50'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 stroke-[1.6] transition-colors',
                    isActive ? 'text-terracotta-500' : 'text-ink-400'
                  )}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Family Section */}
      <div className="pt-6 border-t border-borderWarm-subtle">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-serif italic text-ink-500 font-medium">
            Family
          </span>
          <span className="text-[11px] text-ink-400">
            {members.length} members
          </span>
        </div>

        {/* Family Member avatars */}
        <div className="space-y-2 mb-3.5">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-cream-200/40 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  {member.avatar_url ? (
                    <img
                      src={member.avatar_url}
                      alt={member.name}
                      className="w-7 h-7 rounded-full object-cover border border-borderWarm"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-cream-300 text-ink-700 flex items-center justify-center text-xs font-medium">
                      {member.initials}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-botanical-500 border border-white" />
                </div>
                <span className="text-xs text-ink-800 font-normal truncate">
                  {member.name === 'Durga Prasad' ? 'You' : member.name}
                </span>
              </div>
              <span className="text-[10px] text-ink-400 font-mono">
                {member.role === 'Owner' ? 'Admin' : ''}
              </span>
            </div>
          ))}
        </div>

        {/* + Invite member */}
        <button
          type="button"
          onClick={onInviteMember}
          className="w-full flex items-center gap-2 px-2 py-2 text-xs font-medium text-terracotta-600 hover:text-terracotta-700 hover:bg-terracotta-50 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Invite member</span>
        </button>
      </div>
    </aside>
  );
};
