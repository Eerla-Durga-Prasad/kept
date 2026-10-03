import React from 'react';
import { Home, ShoppingBag, CalendarDays, BookOpen } from 'lucide-react';
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
  const tabs = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'groceries' as NavTab, label: 'Groceries', icon: ShoppingBag, badge: groceryBadgeCount },
    { id: 'meals' as NavTab, label: 'Meals', icon: CalendarDays },
    { id: 'recipes' as NavTab, label: 'Recipes', icon: BookOpen },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-borderWarm z-40 md:hidden pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-16 py-1 transition-colors relative',
                isActive ? 'text-terracotta-500' : 'text-ink-500 hover:text-ink-800'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5 stroke-[1.7]" />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-4 h-4 bg-terracotta-500 text-white rounded-full text-[10px] font-medium flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[11px] font-medium tracking-tight">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-terracotta-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
