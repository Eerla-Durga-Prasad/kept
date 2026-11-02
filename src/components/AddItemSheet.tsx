import React, { useState, useEffect } from 'react';
import { CategoryType, HouseholdMember } from '../sync/types';
import { detectGroceryCategory, ALL_CATEGORIES } from '../lib/groceryCategorizer';
import { X, Sparkles, User, Tag } from 'lucide-react';

interface AddItemSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: {
    name: string;
    quantity: string;
    category: CategoryType;
    addToMealPlan: boolean;
    household_id?: string;
    assigned_to_user_id?: string;
  }) => Promise<void>;
  defaultCategory?: CategoryType;
  members?: HouseholdMember[];
  currentMember?: HouseholdMember | null;
}

export const AddItemSheet: React.FC<AddItemSheetProps> = ({
  isOpen,
  onClose,
  onAddItem,
  defaultCategory = 'Produce',
  members = [],
  currentMember = null,
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1 pack');
  const [category, setCategory] = useState<CategoryType>(defaultCategory);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [autoDetectedCategory, setAutoDetectedCategory] = useState<CategoryType | null>(null);
  const [assignedMemberId, setAssignedMemberId] = useState<string>(() => currentMember?.id || members[0]?.id || '');
  const [addToMealPlan, setAddToMealPlan] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setName('');
      setQuantity('1 pack');
      setCategory(defaultCategory);
      setIsManualOverride(false);
      setAutoDetectedCategory(null);
      setAssignedMemberId(currentMember?.id || members[0]?.id || '');
      setAddToMealPlan(false);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultCategory, currentMember, members]);

  // Handle automatic category detection as user types
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);

    if (!val.trim()) {
      setAutoDetectedCategory(null);
      if (!isManualOverride) {
        setCategory(defaultCategory);
      }
      return;
    }

    const detection = detectGroceryCategory(val);
    if (detection.category) {
      setAutoDetectedCategory(detection.category);
      // Auto-assign unless user explicitly clicked a different category
      if (!isManualOverride) {
        setCategory(detection.category);
      }
    } else {
      setAutoDetectedCategory(null);
    }
  };

  const handleSelectCategory = (cat: CategoryType) => {
    setCategory(cat);
    setIsManualOverride(true);
  };

  if (!isOpen) return null;

  const selectedMember = members.find((m) => m.id === assignedMemberId) || currentMember;

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
        household_id: selectedMember?.household_id || currentMember?.household_id || 'h_default_household_01',
        assigned_to_user_id: selectedMember?.user_id || currentMember?.user_id,
      });
      setName('');
      setQuantity('1 pack');
      setAddToMealPlan(false);
      setIsManualOverride(false);
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
      <div className="relative w-full max-w-lg bg-cream-50 rounded-t-2xl sm:rounded-2xl border border-borderWarm shadow-float p-4 xs:p-6 sm:p-7 z-10 animate-sheetUp sm:animate-fadeIn max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-borderWarm-subtle">
          <div>
            <h3 className="font-serif text-xl xs:text-2xl font-medium tracking-tight text-ink-900">
              Add Item
            </h3>
            <p className="text-[11px] xs:text-xs text-ink-500 mt-0.5">
              Add essentials to your shared household kitchen.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add item sheet"
            className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Name Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] xs:text-xs font-medium text-ink-700 uppercase tracking-wider">
                Item name
              </label>
              {autoDetectedCategory && !isManualOverride && (
                <span className="inline-flex items-center gap-1 text-[10px] xs:text-[11px] text-terracotta-700 font-medium bg-terracotta-50 px-2 py-0.5 rounded-full border border-terracotta-200/70 animate-fadeIn">
                  <Sparkles className="w-3 h-3 text-terracotta-500" />
                  Auto-detected: {autoDetectedCategory}
                </span>
              )}
            </div>
            <input
              type="text"
              required
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Milk, Aloo, Toor Dal, Surf Excel..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-borderWarm rounded-xl focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 text-ink-900 placeholder:text-ink-400 shadow-subtle"
              autoFocus
            />
          </div>

          {/* Interactive Category Selector (Mobile Touch-Friendly Pills) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] xs:text-xs font-medium text-ink-700 uppercase tracking-wider">
                Category
              </label>
              {isManualOverride ? (
                <span className="text-[10px] xs:text-[11px] text-ink-500">
                  Manual selection
                </span>
              ) : !autoDetectedCategory && name.trim() ? (
                <span className="text-[10px] xs:text-[11px] text-amber-700 font-medium">
                  Please confirm category
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5 xs:gap-2">
              {ALL_CATEGORIES.map((cat) => {
                const isSelected = category === cat;
                const isDetected = autoDetectedCategory === cat && !isManualOverride;

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 select-none ${
                      isSelected
                        ? 'bg-ink-900 border-ink-900 text-white shadow-subtle scale-[1.02]'
                        : isDetected
                        ? 'bg-terracotta-50 border-terracotta-400 text-terracotta-800'
                        : 'bg-white border-borderWarm text-ink-700 hover:border-terracotta-300 hover:bg-cream-100'
                    }`}
                  >
                    <Tag className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-ink-400'}`} />
                    <span>{cat}</span>
                    {isDetected && (
                      <span className="text-[9px] bg-terracotta-500 text-white px-1.5 py-0.2 rounded-full font-sans">
                        Auto
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity & Household Member (Responsive: 1 column on < 360px, 2 columns on >= 360px) */}
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] xs:text-xs font-medium text-ink-700 uppercase tracking-wider mb-1.5">
                Quantity
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 500 g, 2 L, 1 pack"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-borderWarm rounded-xl focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 text-ink-900 placeholder:text-ink-400 shadow-subtle"
              />
            </div>

            {/* Household Member Assignment */}
            <div>
              <label className="block text-[11px] xs:text-xs font-medium text-ink-700 uppercase tracking-wider mb-1.5">
                Assigned To
              </label>
              {members && members.length > 0 ? (
                <div className="relative">
                  <select
                    value={assignedMemberId}
                    onChange={(e) => setAssignedMemberId(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs xs:text-sm bg-white border border-borderWarm rounded-xl focus:outline-none focus:border-terracotta-500 focus:ring-1 focus:ring-terracotta-500 text-ink-900 shadow-subtle"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.id === currentMember?.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-borderWarm rounded-xl text-xs text-ink-600 shadow-subtle">
                  <User className="w-3.5 h-3.5 text-ink-400" />
                  <span className="truncate">{currentMember?.name || 'Household Shared List'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Toggle Add to Meal Plan */}
          <div className="flex items-center justify-between py-2 px-1">
            <div className="pr-2">
              <span className="text-xs xs:text-sm font-medium text-ink-800">
                Add to meal plan
              </span>
              <p className="text-[10px] xs:text-xs text-ink-500">
                Flag this ingredient for this week's dinner menu
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={addToMealPlan}
              onClick={() => setAddToMealPlan(!addToMealPlan)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
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
              className="w-full py-2.5 xs:py-3 px-4 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-50 text-white text-xs xs:text-sm font-medium rounded-xl shadow-subtle transition-all duration-200 flex items-center justify-center cursor-pointer active:scale-[0.99]"
            >
              {isSubmitting ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
