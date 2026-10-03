import React from 'react';
import { Item, CategoryType } from '../sync/types';
import { GroceryItem } from './GroceryItem';
import { Plus } from 'lucide-react';

interface GrocerySectionProps {
  title: CategoryType;
  items: Item[];
  onToggleCheck: (itemId: string, currentChecked: boolean) => void;
  onUpdateQuantity?: (itemId: string, newQuantity: string) => void;
  onDelete?: (itemId: string) => void;
  onAddItemToCategory?: (category: CategoryType) => void;
  onSyncClick?: () => void;
}

export const GrocerySection: React.FC<GrocerySectionProps> = ({
  title,
  items,
  onToggleCheck,
  onUpdateQuantity,
  onDelete,
  onAddItemToCategory,
  onSyncClick,
}) => {
  const activeItems = items.filter((i) => !i.deleted_at);
  const checkedCount = activeItems.filter((i) => i.checked).length;

  return (
    <div className="bg-white rounded-xl border border-borderWarm p-5 shadow-card transition-shadow hover:shadow-subtle flex flex-col h-full">
      {/* Category Card Header */}
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-borderWarm-subtle">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-xl font-medium tracking-tight text-ink-900">
            {title}
          </h2>
          <span className="text-xs text-ink-400 font-sans font-normal">
            {checkedCount > 0 ? `${checkedCount}/${activeItems.length} done` : `${activeItems.length} items`}
          </span>
        </div>

        {onAddItemToCategory && (
          <button
            type="button"
            onClick={() => onAddItemToCategory(title)}
            className="p-1 rounded text-ink-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition-colors"
            title={`Add item to ${title}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 flex flex-col justify-start">
        {activeItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-ink-400 font-normal">
            No items in {title.toLowerCase()}
          </div>
        ) : (
          <div className="divide-y divide-borderWarm-subtle/40">
            {activeItems.map((item) => (
              <GroceryItem
                key={item.id}
                item={item}
                onToggleCheck={onToggleCheck}
                onUpdateQuantity={onUpdateQuantity}
                onDelete={onDelete}
                onSyncClick={onSyncClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
