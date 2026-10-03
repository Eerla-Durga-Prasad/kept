import React, { useState } from 'react';
import { CategoryType } from '../sync/types';
import { X } from 'lucide-react';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: {
    name: string;
    quantity: string;
    category: CategoryType;
    addToMealPlan: boolean;
  }) => Promise<void>;
  defaultCategory?: CategoryType;
}

const CATEGORIES: CategoryType[] = [
  'Produce',
  'Dairy',
  'Pantry',
  'Meat & Seafood',
  'Household',
];

export const AddItemSheet: React.FC<AddItemSheetProps> = ({
  isOpen,
  onClose,
  onAddItem,
  defaultCategory = 'Produce',
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1 pack');
  const [category, setCategory] = useState<CategoryType>(defaultCategory);
  const [addToMealPlan, setAddToMealPlan] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddItem({
        name: name.trim(),
        quantity: quantity.trim() || '1 item',
        category,
        addToMealPlan,
      });
      setName('');
      setQuantity('1 pack');
      setAddToMealPlan(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/35 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal / Bottom Sheet */}
      <div className="relative w-full max-w-lg bg-cream-50 rounded-t-2xl sm:rounded-2xl border border-borderWarm shadow-float p-6 sm:p-7 z-10 animate-sheetUp sm:animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-borderWarm-subtle">
          <div>
            <h3 className="font-serif text-2xl font-medium tracking-tight text-ink-900">
              Add Item
            </h3>
            <p className="text-xs text-ink-500 mt-0.5">
              Add essentials to your shared household kitchen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-700 uppercase tracking-wider mb-1.5">
              Item name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fresh Coriander, Coconut Milk..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-borderWarm rounded-lg focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 text-ink-900 placeholder:text-ink-400"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-ink-700 uppercase tracking-wider mb-1.5">
                Quantity
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 500 g, 2 bunches"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-borderWarm rounded-lg focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 text-ink-900 placeholder:text-ink-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-700 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-borderWarm rounded-lg focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 text-ink-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle Add to Meal Plan */}
          <div className="flex items-center justify-between py-2 px-1">
            <div>
              <span className="text-sm font-medium text-ink-800">
                Add to meal plan
              </span>
              <p className="text-xs text-ink-500">
                Flag this ingredient for this week's dinner menu
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={addToMealPlan}
              onClick={() => setAddToMealPlan(!addToMealPlan)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                addToMealPlan ? 'bg-terracotta-500' : 'bg-borderWarm-dark'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  addToMealPlan ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2.5 px-4 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-subtle transition-all duration-200 flex items-center justify-center cursor-pointer"
            >
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
