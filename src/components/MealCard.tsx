import React from 'react';
import { Meal, Recipe } from '../sync/types';
import { Plus, Flame } from 'lucide-react';
import { getMealDefinition } from '../lib/mealCatalog';
import { SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';
import { calculateMealCalories } from '../lib/calorieCalculator';

interface MealCardProps {
  meal?: Meal;
  day: string;
  mealType: string;
  recipes?: Recipe[];
  onAddMealClick: (day: string, mealType: string) => void;
  onMealClick?: (meal: Meal) => void;
  onServingChange?: (meal: Meal, newServings: number) => void;
}

export const MealCard: React.FC<MealCardProps> = ({
  meal,
  day,
  mealType,
  recipes = [],
  onAddMealClick,
  onMealClick,
  onServingChange,
}) => {
  if (!meal) {
    return (
      <div className="flex flex-col w-full gap-1.5">
        <button
          type="button"
          onClick={() => onAddMealClick(day, mealType)}
          className="group w-full h-[92px] rounded-lg border border-dashed border-borderWarm hover:border-terracotta-400 bg-white/40 hover:bg-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer text-ink-400 hover:text-terracotta-600"
        >
          <Plus className="w-4 h-4 stroke-[1.5] group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-sans">Add meal</span>
        </button>
        {/* Placeholder spacer to maintain uniform grid row heights */}
        <div className="h-4 flex items-center justify-center text-[10px] text-ink-300 select-none">
          —
        </div>
      </div>
    );
  }

  const selectedMeal = getMealDefinition(meal, recipes);
  const displayTitle = meal.title || selectedMeal?.name || 'Meal';
  const displayImage = meal.image_url || selectedMeal?.image || SAFE_FALLBACK_FOOD_IMAGE;
  const currentServings = meal.servings ?? 1;

  // Calculate calories using nutritional data and serving size
  const calResult = calculateMealCalories(meal, recipes);

  const handleDecreaseServings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onServingChange) return;
    const next = currentServings <= 1 ? 0.5 : currentServings - 1;
    if (next >= 0.5) {
      onServingChange(meal, next);
    }
  };

  const handleIncreaseServings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onServingChange) return;
    const next = currentServings < 1 ? 1 : currentServings + 1;
    if (next <= 12) {
      onServingChange(meal, next);
    }
  };

  return (
    <div className="flex flex-col w-full gap-1.5">
      {/* Meal Card Graphic */}
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
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/35 to-transparent" />

        {/* Content */}
        <div className="relative z-10">
          <span className="text-white text-xs font-medium tracking-tight line-clamp-1 group-hover:text-cream-100 drop-shadow-sm">
            {displayTitle}
          </span>
          <span className="text-[10px] text-cream-300 block font-normal opacity-90 truncate">
            {selectedMeal?.category || meal.meal_type}
          </span>
        </div>
      </div>

      {/* Calories & Serving Controls Directly Below Every Individual Meal Card */}
      <div className="flex items-center justify-between px-0.5 min-h-[18px] text-[11px] leading-none">
        {calResult.calories !== null ? (
          <div
            className="flex items-center gap-1 min-w-0"
            title={calResult.details || `Estimated ${calResult.calories} kcal`}
          >
            <Flame className="w-3 h-3 text-terracotta-500 shrink-0" />
            <span className="font-mono font-semibold text-terracotta-700 text-[11px]">
              ~{calResult.calories}
            </span>
            <span className="text-[10px] text-ink-500 font-sans">kcal</span>
          </div>
        ) : (
          <span
            className="text-[10px] italic text-ink-400 truncate"
            title="Nutritional data unavailable for this dish"
          >
            Calories unavailable
          </span>
        )}

        {/* Interactive Serving Counter */}
        {onServingChange && (
          <div
            className="flex items-center gap-0.5 bg-cream-100/90 rounded px-1 py-0.5 border border-borderWarm text-ink-700 shrink-0 ml-1 select-none"
            title={`Serving size: ${currentServings}`}
          >
            <button
              type="button"
              onClick={handleDecreaseServings}
              disabled={currentServings <= 0.5}
              aria-label="Decrease serving size"
              className="w-3.5 h-3.5 flex items-center justify-center font-bold text-ink-600 hover:text-ink-900 disabled:opacity-25 cursor-pointer hover:bg-cream-200 rounded text-[11px]"
            >
              -
            </button>
            <span className="text-[10px] font-mono font-medium px-0.5 text-ink-800">
              {currentServings}s
            </span>
            <button
              type="button"
              onClick={handleIncreaseServings}
              disabled={currentServings >= 12}
              aria-label="Increase serving size"
              className="w-3.5 h-3.5 flex items-center justify-center font-bold text-ink-600 hover:text-ink-900 disabled:opacity-25 cursor-pointer hover:bg-cream-200 rounded text-[11px]"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

