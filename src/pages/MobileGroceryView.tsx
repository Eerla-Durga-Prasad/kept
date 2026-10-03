import React, { useState } from 'react';
import { Item, CategoryType } from '../sync/types';
import { GroceryItem } from '../components/GroceryItem';
import { SyncIndicator } from '../components/SyncIndicator';
import { ArrowLeft, Plus } from 'lucide-react';
import { SyncEngineStatus } from '../sync/syncEngine';

interface MobileGroceryViewProps {
  items: Item[];
  onBack: () => void;
  onToggleCheck: (itemId: string, currentChecked: boolean) => void;
  onUpdateQuantity: (itemId: string, newQuantity: string) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenAddItem: (category?: CategoryType) => void;
  onOpenSyncModal: () => void;
  syncStatus: SyncEngineStatus;
}

const CATEGORY_TABS: (CategoryType | 'All')[] = ['All', 'Produce', 'Dairy', 'Pantry'];

export const MobileGroceryView: React.FC<MobileGroceryViewProps> = ({
  items,
  onBack,
  onToggleCheck,
  onUpdateQuantity,
  onDeleteItem,
  onOpenAddItem,
  onOpenSyncModal,
  syncStatus,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');

  const filteredItems = items.filter((item) => {
    if (item.deleted_at) return false;
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });

  return (
    <div className="min-h-full pb-28 pt-4 px-4 bg-cream-50 flex flex-col relative animate-fadeIn">
      {/* Mobile Header: Back arrow | Groceries | Sync indicator */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-borderWarm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-ink-700 hover:text-ink-950 rounded-full transition-colors cursor-pointer"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-ink-900">
            Groceries
          </h1>
        </div>

        {/* Right Sync Indicator: ● Synced */}
        <SyncIndicator
          status={
            !syncStatus.isOnline
              ? 'offline'
              : syncStatus.pendingCount > 0
              ? 'pending'
              : 'synced'
          }
          onClick={onOpenSyncModal}
          showLabel={true}
          className="text-xs bg-white px-2.5 py-1 rounded-full border border-borderWarm shadow-subtle cursor-pointer"
        />
      </div>

      {/* Category Tabs: All / Produce / Dairy / Pantry */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none text-xs">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedCategory(tab)}
              className={`px-4 py-1.5 rounded-full border transition-all cursor-pointer font-medium shrink-0 ${
                isActive
                  ? 'bg-ink-900 border-ink-900 text-white shadow-subtle'
                  : 'bg-white border-borderWarm text-ink-600 hover:bg-cream-100'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Items list vertical */}
      <div className="bg-white rounded-xl border border-borderWarm divide-y divide-borderWarm-subtle/50 shadow-card flex-1">
        {filteredItems.length === 0 ? (
          <div className="py-12 text-center text-xs text-ink-400">
            No items in {selectedCategory.toLowerCase()}. Tap + to add.
          </div>
        ) : (
          filteredItems.map((item) => (
            <GroceryItem
              key={item.id}
              item={item}
              onToggleCheck={onToggleCheck}
              onUpdateQuantity={onUpdateQuantity}
              onDelete={onDeleteItem}
              onSyncClick={onOpenSyncModal}
            />
          ))
        )}
      </div>

      {/* Bottom-right floating button: + Add item (terracotta) */}
      <button
        type="button"
        onClick={() => onOpenAddItem()}
        className="fixed bottom-20 right-5 z-30 w-14 h-14 rounded-full bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-float flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Add item"
      >
        <Plus className="w-6 h-6 stroke-[2]" />
      </button>
    </div>
  );
};
