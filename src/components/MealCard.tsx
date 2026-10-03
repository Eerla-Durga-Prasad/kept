import React from 'react';
import { Meal } from '../sync/types';
import { Plus } from 'lucide-react';
import { getMealDefinition } from '../lib/mealCatalog';
import { SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';

interface MealCardProps {
  meal?: Meal;
  day: string;
  mealType: string;
  onAddMealClick: (day: string, mealType: string) => void;
  onMealClick?: (meal: Meal) => void;
}

export const MealCard: React.FC<MealCardProps> = ({
  meal,
  day,
  mealType,
  onAddMealClick,
  onMealClick,
}) => {
  if (!meal) {
    return (
      <button
        type="button"
        onClick={() => onAddMealClick(day, mealType)}
        className="group w-full h-[92px] rounded-lg border border-dashed border-borderWarm hover:border-terracotta-400 bg-white/40 hover:bg-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-ink-400 hover:text-terracotta-600"
      >
        <Plus className="w-4 h-4 stroke-[1.5] group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-sans">Add meal</span>
      </button>
    );
  }

  const selectedMeal = getMealDefinition(meal);
  const displayTitle = meal.title || selectedMeal?.name || 'Meal';
  const displayImage = meal.image_url || selectedMeal?.image || SAFE_FALLBACK_FOOD_IMAGE;

  return (
    <div
      onClick={() => onMealClick && onMealClick(meal)}
      className="group relative w-full h-[92px] rounded-lg border border-borderWarm bg-white hover:border-borderWarm-dark shadow-subtle overflow-hidden flex flex-col justify-end p-2 cursor-pointer transition-all hover:-translate-y-0.5"
    >
      {/* Background food photo */}
      <img
        src={displayImage}
        alt={displayTitle}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      {/* Gradient readability overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10">
        <span className="text-white text-xs font-medium tracking-tight line-clamp-1 group-hover:text-cream-100 drop-shadow-sm">
          {displayTitle}
        </span>
        <span className="text-[10px] text-cream-300 block font-normal opacity-90">
          {selectedMeal?.category || meal.meal_type}
        </span>
      </div>
    </div>
  );
};
