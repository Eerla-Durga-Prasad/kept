import React, { useState } from 'react';
import { Home, ShoppingBag, CalendarDays, BookOpen, MoreHorizontal, Users, Settings, X } from 'lucide-react';
import { NavTab } from './Sidebar';
import { cn } from '../lib/utils';

interface MobileNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  groceryBadgeCount?: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  groceryBadgeCount = 0,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'groceries' as NavTab, label: 'Groceries', icon: ShoppingBag, badge: groceryBadgeCount },
    { id: 'meals' as NavTab, label: 'Meals', icon: CalendarDays },
    { id: 'recipes' as NavTab, label: 'Recipes', icon: BookOpen },
  ];

  const moreTabs = [
    { id: 'household' as NavTab, label: 'Household', icon: Users },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const isMoreActive = currentTab === 'household' || currentTab === 'settings';

  const handleSelectMoreTab = (tab: NavTab) => {
    onSelectTab(tab);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* More drawer backdrop */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/20 backdrop-blur-sm md:hidden"
          onClick={() => setIsMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More drawer panel */}
      {isMoreOpen && (
        <div className="fixed bottom-[64px] inset-x-0 z-50 md:hidden animate-sheetUp">
          <div className="max-w-lg mx-auto px-4 pb-2">
            <div className="bg-white rounded-2xl border border-borderWarm shadow-float overflow-hidden">
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-borderWarm/60">
                <span className="font-serif text-sm font-medium text-ink-700">More</span>
                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-cream-100 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* More tab items */}
              <div className="p-2 space-y-1">
                {moreTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleSelectMoreTab(tab.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all text-left',
                        isActive
                          ? 'bg-terracotta-50 text-terracotta-700 border border-terracotta-200'
                          : 'text-ink-700 hover:bg-cream-100'
                      )}
                    >
                      <Icon className={cn('w-5 h-5 stroke-[1.6]', isActive ? 'text-terracotta-500' : 'text-ink-400')} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-borderWarm z-40 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-2 py-1.5 rounded-xl transition-colors relative',
                  isActive ? 'text-terracotta-500' : 'text-ink-500 hover:text-ink-800'
                )}
                style={{ minHeight: '44px' }}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 stroke-[1.7]" />
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 bg-terracotta-500 text-white rounded-full text-[10px] font-medium flex items-center justify-center">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-medium tracking-tight leading-none mt-0.5">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-terracotta-500" />
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-2 py-1.5 rounded-xl transition-colors relative',
              isMoreActive ? 'text-terracotta-500' : 'text-ink-500 hover:text-ink-800'
            )}
            style={{ minHeight: '44px' }}
            aria-label="More navigation options"
            aria-expanded={isMoreOpen}
          >
            <MoreHorizontal className="w-5 h-5 stroke-[1.7]" />
            <span className="text-[10px] font-medium tracking-tight leading-none mt-0.5">More</span>
            {isMoreActive && (
              <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-terracotta-500" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
};
