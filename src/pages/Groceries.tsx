import React, { useState } from 'react';
import { Item, CategoryType } from '../sync/types';
import { GrocerySection } from '../components/GrocerySection';
import { Search, Plus } from 'lucide-react';

interface GroceriesProps {
  items: Item[];
  onToggleCheck: (itemId: string, currentChecked: boolean) => void;
  onUpdateQuantity: (itemId: string, newQuantity: string) => void;
  onDeleteItem: (itemId: string) => void;
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
  onOpenAddItem,
  onOpenSyncModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items by category tab and search query
  const filteredItems = items.filter((item) => {
    if (item.deleted_at) return false;
    const matchesCategory =
      selectedCategory === 'All' ? true : item.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === ''
        ? true
        : item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.quantity.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group items by category
  const produceItems = filteredItems.filter((i) => i.category === 'Produce');
  const dairyItems = filteredItems.filter((i) => i.category === 'Dairy');
  const pantryItems = filteredItems.filter((i) => i.category === 'Pantry');
  const otherItems = filteredItems.filter(
    (i) => i.category !== 'Produce' && i.category !== 'Dairy' && i.category !== 'Pantry'
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 animate-fadeIn">
      {/* Header section matching reference */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-6 border-b border-borderWarm">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
            Groceries
          </h1>
          <p className="font-sans text-sm sm:text-base text-ink-500 mt-1.5 font-normal">
            Everything for a happier kitchen.
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
            onClick={() => onOpenAddItem()}
            className="px-4 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-subtle hover:shadow transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2]" />
            <span>+ Add item</span>
          </button>
        </div>
      </div>

      {/* Top category navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none text-xs sm:text-sm">
        {CATEGORY_TABS.map((tab) => {
          const isActive = selectedCategory === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setSelectedCategory(tab)}
              className={`px-3.5 py-1.5 rounded-full border transition-all cursor-pointer shrink-0 font-medium ${
                isActive
                  ? 'bg-ink-900 border-ink-900 text-white shadow-subtle'
                  : 'bg-white border-borderWarm text-ink-600 hover:border-borderWarm-dark hover:bg-cream-100'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Main content: Three elegant category cards / sections */}
      {selectedCategory === 'All' ? (
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

          {otherItems.length > 0 && (
            <div className="col-span-full mt-4">
              <GrocerySection
                title="Meat & Seafood"
                items={otherItems}
                onToggleCheck={onToggleCheck}
                onUpdateQuantity={onUpdateQuantity}
                onDelete={onDeleteItem}
                onAddItemToCategory={onOpenAddItem}
                onSyncClick={onOpenSyncModal}
              />
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
    </div>
  );
};
