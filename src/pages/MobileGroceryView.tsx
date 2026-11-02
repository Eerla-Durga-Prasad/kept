import React, { useState } from 'react';
import { Item, CategoryType } from '../sync/types';
import { GroceryItem } from '../components/GroceryItem';
import { SyncIndicator } from '../components/SyncIndicator';
import { ArrowLeft, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { SyncEngineStatus } from '../sync/syncEngine';

interface MobileGroceryViewProps {
  items: Item[];
  onBack: () => void;
  onToggleCheck: (itemId: string, currentChecked: boolean) => void;
  onUpdateQuantity: (itemId: string, newQuantity: string) => void;
  onDeleteItem: (itemId: string) => void;
  onRemoveAll?: () => Promise<void> | void;
  onOpenAddItem: (category?: CategoryType) => void;
  onOpenSyncModal: () => void;
  syncStatus: SyncEngineStatus;
}

const CATEGORY_TABS: (CategoryType | 'All')[] = [
  'All',
  'Produce',
  'Dairy',
  'Pantry',
  'Meat & Seafood',
  'Household',
];

export const MobileGroceryView: React.FC<MobileGroceryViewProps> = ({
  items,
  onBack,
  onToggleCheck,
  onUpdateQuantity,
  onDeleteItem,
  onRemoveAll,
  onOpenAddItem,
  onOpenSyncModal,
  syncStatus,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeItems = items.filter((item) => !item.deleted_at);
  const filteredItems = activeItems.filter((item) => {
    if (selectedCategory === 'All') return true;
    return item.category === selectedCategory;
  });

  const handleConfirmRemoveAll = async () => {
    if (!onRemoveAll || isRemoving) return;
    setIsRemoving(true);
    try {
      await onRemoveAll();
      setIsConfirmOpen(false);
      setActionNotice('All items removed from grocery list.');
      setTimeout(() => setActionNotice(null), 3500);
    } catch {
      setActionNotice('Failed to remove items. Please try again.');
      setTimeout(() => setActionNotice(null), 3500);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="min-h-full pb-28 pt-4 px-3 xs:px-4 bg-cream-50 flex flex-col relative animate-fadeIn">
      {/* Mobile Header: Back arrow | Groceries | Sync indicator */}
      <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-borderWarm">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 text-ink-700 hover:text-ink-950 rounded-full transition-colors cursor-pointer"
            aria-label="Back to home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-serif text-xl xs:text-2xl font-semibold tracking-tight text-ink-900 leading-tight">
              Groceries
            </h1>
            <span className="text-[10px] xs:text-[11px] text-ink-500 font-sans block">
              {activeItems.length} active {activeItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>
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
          className="text-[11px] xs:text-xs bg-white px-2 xs:px-2.5 py-1 rounded-full border border-borderWarm shadow-subtle cursor-pointer shrink-0"
        />
      </div>

      {/* Success Notification Banner */}
      {actionNotice && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs shadow-subtle mb-3 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 font-medium">{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-bold px-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Category Tabs: All / Produce / Dairy / Pantry / Meat & Seafood / Household */}
      <div className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto pb-2.5 mb-3 scrollbar-none text-xs">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab;
          const count =
            tab === 'All'
              ? activeItems.length
              : activeItems.filter((i) => i.category === tab).length;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedCategory(tab)}
              className={`px-3 xs:px-3.5 py-1.5 rounded-full border transition-all cursor-pointer font-medium shrink-0 flex items-center gap-1 select-none text-[11px] xs:text-xs ${
                isActive
                  ? 'bg-ink-900 border-ink-900 text-white shadow-subtle'
                  : 'bg-white border-borderWarm text-ink-600 hover:bg-cream-100'
              }`}
            >
              <span>{tab}</span>
              {count > 0 && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-cream-100 text-ink-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Items list vertical */}
      <div className="bg-white rounded-xl border border-borderWarm divide-y divide-borderWarm-subtle/50 shadow-card flex-1">
        {filteredItems.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-ink-400">
            {selectedCategory === 'All'
              ? 'Your grocery list is empty. Tap + to add items.'
              : `No items in ${selectedCategory.toLowerCase()}. Tap + to add.`}
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

      {/* Requirement 3: Clearly visible "Remove All" Button at the bottom of the list */}
      {activeItems.length > 0 && (
        <div className="mt-4 pt-1 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isRemoving}
            className="w-full xs:w-auto px-4 py-2.5 rounded-xl border border-rose-200 bg-white hover:bg-rose-50/80 active:bg-rose-100/80 text-rose-700 transition-all text-xs font-medium flex items-center justify-center gap-2 cursor-pointer shadow-subtle hover:border-rose-300"
          >
            <Trash2 className="w-4 h-4 stroke-[1.8] text-rose-500" />
            <span>Remove All Items ({activeItems.length})</span>
          </button>
        </div>
      )}

      {/* Confirmation Dialog / Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] transition-opacity"
            onClick={() => !isRemoving && setIsConfirmOpen(false)}
          />

          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-borderWarm shadow-float p-5 z-10 animate-fadeIn space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-serif text-lg font-semibold text-ink-900 leading-tight">
                  Remove All Items?
                </h3>
                <p className="text-xs text-ink-600 mt-1 leading-relaxed">
                  Are you sure you want to remove all <span className="font-semibold text-ink-900">{activeItems.length} items</span> from your grocery list? Saved meal plans and recipes will remain unaffected.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2 border-t border-borderWarm/60">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isRemoving}
                className="flex-1 py-2.5 px-3 rounded-xl border border-borderWarm text-ink-700 hover:bg-cream-100 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveAll}
                disabled={isRemoving}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-medium transition-colors shadow-subtle cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isRemoving ? (
                  <span>Removing...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Remove All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-right floating button: + Add item (terracotta) */}
      <button
        type="button"
        onClick={() => onOpenAddItem()}
        className="fixed bottom-20 right-4 xs:right-5 z-30 w-13 h-13 xs:w-14 xs:h-14 rounded-full bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-float flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Add grocery item"
      >
        <Plus className="w-6 h-6 stroke-[2]" />
      </button>
    </div>
  );
};
