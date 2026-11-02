import React, { useState } from 'react';
import { Item, CategoryType } from '../sync/types';
import { GrocerySection } from '../components/GrocerySection';
import { Search, Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

interface GroceriesProps {
  items: Item[];
  onToggleCheck: (itemId: string, currentChecked: boolean) => void;
  onUpdateQuantity: (itemId: string, newQuantity: string) => void;
  onDeleteItem: (itemId: string) => void;
  onRemoveAll?: () => Promise<void> | void;
  onOpenAddItem: (category?: CategoryType) => void;
  onOpenSyncModal: () => void;
}

const CATEGORY_TABS: (CategoryType | 'All')[] = [
  'All',
  'Produce',
  'Dairy',
  'Pantry',
  'Meat & Seafood',
  'Household',
];

export const Groceries: React.FC<GroceriesProps> = ({
  items,
  onToggleCheck,
  onUpdateQuantity,
  onDeleteItem,
  onRemoveAll,
  onOpenAddItem,
  onOpenSyncModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeItems = items.filter((item) => !item.deleted_at);

  // Filter items by category tab and search query
  const filteredItems = activeItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' ? true : item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === ''
        ? true
        : item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.quantity.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group items by category for 'All' grid view
  const produceItems = filteredItems.filter((i) => i.category === 'Produce');
  const dairyItems = filteredItems.filter((i) => i.category === 'Dairy');
  const pantryItems = filteredItems.filter((i) => i.category === 'Pantry');
  const meatItems = filteredItems.filter((i) => i.category === 'Meat & Seafood');
  const householdItems = filteredItems.filter((i) => i.category === 'Household');

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
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-6 border-b border-borderWarm">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
            Groceries
          </h1>
          <p className="font-sans text-sm sm:text-base text-ink-500 mt-1.5 font-normal">
            Everything for a happier kitchen • {activeItems.length} active {activeItems.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        {/* Right side: Search field & Terracotta "+ Add item" button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search or add an item..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-borderWarm rounded-xl text-xs sm:text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 transition-colors shadow-subtle"
            />
          </div>

          <button
            type="button"
            onClick={() => onOpenAddItem(selectedCategory === 'All' ? undefined : selectedCategory)}
            className="px-4 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-subtle hover:shadow transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>+ Add item</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionNotice && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm shadow-subtle mb-6 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="flex-1 font-medium">{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-sm font-bold px-1.5"
          >
            ×
          </button>
        </div>
      )}

      {/* Top category navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none text-xs sm:text-sm">
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
              className={`px-3.5 py-1.5 rounded-full border transition-all cursor-pointer shrink-0 font-medium flex items-center gap-1.5 select-none ${
                isActive
                  ? 'bg-ink-900 border-ink-900 text-white shadow-subtle'
                  : 'bg-white border-borderWarm text-ink-600 hover:border-borderWarm-dark hover:bg-cream-100'
              }`}
            >
              <span>{tab}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
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

      {/* Main content: Category cards / sections */}
      {selectedCategory === 'All' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GrocerySection
              title="Produce"
              items={produceItems}
              onToggleCheck={onToggleCheck}
              onUpdateQuantity={onUpdateQuantity}
              onDelete={onDeleteItem}
              onAddItemToCategory={onOpenAddItem}
              onSyncClick={onOpenSyncModal}
            />
            <GrocerySection
              title="Dairy"
              items={dairyItems}
              onToggleCheck={onToggleCheck}
              onUpdateQuantity={onUpdateQuantity}
              onDelete={onDeleteItem}
              onAddItemToCategory={onOpenAddItem}
              onSyncClick={onOpenSyncModal}
            />
            <GrocerySection
              title="Pantry"
              items={pantryItems}
              onToggleCheck={onToggleCheck}
              onUpdateQuantity={onUpdateQuantity}
              onDelete={onDeleteItem}
              onAddItemToCategory={onOpenAddItem}
              onSyncClick={onOpenSyncModal}
            />
          </div>

          {(meatItems.length > 0 || householdItems.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {meatItems.length > 0 && (
                <GrocerySection
                  title="Meat & Seafood"
                  items={meatItems}
                  onToggleCheck={onToggleCheck}
                  onUpdateQuantity={onUpdateQuantity}
                  onDelete={onDeleteItem}
                  onAddItemToCategory={onOpenAddItem}
                  onSyncClick={onOpenSyncModal}
                />
              )}
              {householdItems.length > 0 && (
                <GrocerySection
                  title="Household"
                  items={householdItems}
                  onToggleCheck={onToggleCheck}
                  onUpdateQuantity={onUpdateQuantity}
                  onDelete={onDeleteItem}
                  onAddItemToCategory={onOpenAddItem}
                  onSyncClick={onOpenSyncModal}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <GrocerySection
            title={selectedCategory}
            items={filteredItems}
            onToggleCheck={onToggleCheck}
            onUpdateQuantity={onUpdateQuantity}
            onDelete={onDeleteItem}
            onAddItemToCategory={onOpenAddItem}
            onSyncClick={onOpenSyncModal}
          />
        </div>
      )}

      {/* Requirement 3: Clearly visible "Remove All" Button at the bottom of the grocery list */}
      {activeItems.length > 0 && (
        <div className="mt-8 pt-6 border-t border-borderWarm flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-500 font-sans">
            Managing <span className="font-semibold text-ink-800">{activeItems.length} active items</span> in your shared household kitchen.
          </p>

          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isRemoving}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 transition-colors text-xs font-medium flex items-center justify-center gap-2 cursor-pointer shadow-subtle hover:border-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Remove All ({activeItems.length})</span>
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
                className="flex-1 py-2 px-3 rounded-xl border border-borderWarm text-ink-700 hover:bg-cream-100 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveAll}
                disabled={isRemoving}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-medium transition-colors shadow-subtle cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
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
    </div>
  );
};
