import React, { useState, useEffect } from 'react';
import { Item } from '../sync/types';
import { SyncIndicator } from './SyncIndicator';
import { cn, fireOrganicParticles } from '../lib/utils';
import { MoreHorizontal, Trash2, Edit2, Check } from 'lucide-react';

interface GroceryItemProps {
  item: Item;
  onToggleCheck: (itemId: string, currentChecked: boolean) => void;
  onUpdateQuantity?: (itemId: string, newQuantity: string) => void;
  onDelete?: (itemId: string) => void;
  onSyncClick?: () => void;
}

export const GroceryItem: React.FC<GroceryItemProps> = ({
  item,
  onToggleCheck,
  onUpdateQuantity,
  onDelete,
  onSyncClick,
}) => {
  const [isCompressing, setIsCompressing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editQty, setEditQty] = useState(item.quantity);
  const [showMenu, setShowMenu] = useState(false);

  // Sync editQty when item.quantity changes externally (e.g. from sync engine)
  useEffect(() => {
    if (!isEditing) {
      setEditQty(item.quantity);
    }
  }, [item.quantity, isEditing]);

  const handleCheckboxClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsCompressing(true);

    const willCheck = !item.checked;
    if (willCheck) {
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
      const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
      fireOrganicParticles(xRatio, yRatio);
    }

    setTimeout(() => {
      setIsCompressing(false);
      onToggleCheck(item.id, item.checked);
    }, 180);
  };

  const handleSaveQuantity = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateQuantity && editQty.trim() !== '') {
      onUpdateQuantity(item.id, editQty.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={cn(
        'group relative flex items-center justify-between py-3.5 px-3 rounded-lg transition-all duration-200 hover:bg-cream-100/70 border-b border-borderWarm-subtle/50 last:border-b-0',
        item.checked && 'bg-cream-50/50'
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Custom tactile circular checkbox */}
        <button
          type="button"
          onClick={handleCheckboxClick}
          aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
          className={cn(
            'relative w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 cursor-pointer',
            isCompressing && 'scale-90',
            item.checked
              ? 'bg-botanical-600 border-botanical-600 text-white'
              : 'border-borderWarm-dark hover:border-botanical-500 bg-white'
          )}
        >
          {item.checked ? (
            <svg
              className="w-3.5 h-3.5 text-white stroke-[2.5] animate-checkDraw"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M3.5 8.5L6.5 11.5L12.5 4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="24"
                strokeDashoffset="0"
              />
            </svg>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-sand-200 transition-colors" />
          )}
        </button>

        {/* Item Name & Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[15px] font-normal tracking-[-0.01em] text-ink-900 transition-all duration-200 truncate select-none',
                item.checked && 'line-through text-ink-400 opacity-70'
              )}
            >
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            {isEditing ? (
              <form onSubmit={handleSaveQuantity} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-20 text-xs px-1.5 py-0.5 border border-terracotta-300 rounded focus:outline-none focus:ring-1 focus:ring-terracotta-500 bg-white"
                  autoFocus
                  onBlur={handleSaveQuantity}
                />
                <button
                  type="submit"
                  className="p-0.5 text-botanical-600 hover:text-botanical-700"
                >
                  <Check className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                title="Click to edit quantity"
                className={cn(
                  'text-xs text-ink-500 font-normal hover:text-ink-800 transition-colors cursor-pointer',
                  item.checked && 'opacity-60'
                )}
              >
                {item.quantity}
              </button>
            )}

            {/* Tiny, subtle sync status indicator */}
            <span className="text-borderWarm-dark text-[10px]">•</span>
            <SyncIndicator
              status={item.sync_status}
              onClick={onSyncClick}
              showLabel={true}
              className="opacity-75 hover:opacity-100"
            />
          </div>
        </div>
      </div>

      {/* Item actions */}
      <div className="relative shrink-0 flex items-center">
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-ink-400 hover:text-ink-700 rounded transition-opacity"
          aria-label="Item options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-float border border-borderWarm py-1 z-30 animate-fadeIn">
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-cream-100 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5 text-ink-500" />
                Edit quantity
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onDelete(item.id);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  Remove item
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
