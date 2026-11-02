import React, { useState, useMemo, useEffect } from 'react';
import { Meal, DayOfWeek, MealType, Recipe } from '../sync/types';
import { MealCard } from '../components/MealCard';
import { ChooseMealModal } from '../components/ChooseMealModal';
import { ChevronLeft, ChevronRight, Calendar, Plus, Flame, AlertCircle } from 'lucide-react';
import { db } from '../db/database';
import { enqueueOutboxOperation, generateUUID } from '../sync/outbox';
import { syncEngine } from '../sync/syncEngine';
import { getMealDefinition } from '../lib/mealCatalog';
import { getCachedMealImage, resolveMealImage, SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';
import {
  calculateMealCalories,
  calculateCategoryCalories,
  calculateDailyCalories,
  calculateWeeklyCalories,
  normalizeServingSize,
  lookupDishNutrition,
  CategoryCalorieTotal,
  DailyCalorieTotal,
  WeeklyCalorieTotal,
} from '../lib/calorieCalculator';
import {
  MEAL_TYPES,
  DayInfo,
  formatDateToYYYYMMDD,
  getCurrentWeekMonday,
  getPreviousWeekMonday,
  getNextWeekMonday,
  getWeekDays,
  formatWeekRange,
  hasSavedMealsForWeek,
  isWeekInitialized,
  markWeekInitialized,
  findPreviousWeekMeals,
  copyWeeklyMealPlan,
} from '../lib/mealPlanReuse';

export { getCurrentWeekMonday };

interface MealsProps {
  meals: Meal[];
  recipes?: Recipe[];
  onSaveMeal?: (params: {
    existingMealId?: string;
    household_id: string;
    date: string;
    week_start: string;
    day_of_week: DayOfWeek;
    meal_type: MealType;
    title: string;
    image_url: string;
    recipe_id?: string;
    servings?: number;
    calories_per_serving?: number;
  }) => Promise<void>;
  onDeleteMeal?: (mealId: string) => Promise<void>;
  onAddMeal?: (meal: Omit<Meal, 'id' | 'created_at'>) => void;
  onBatchSaveMeals?: (meals: Meal[]) => Promise<void>;
  onSelectRecipeForMeal?: (recipeId: string) => void;
  isMobile?: boolean;
}

export const Meals: React.FC<MealsProps> = ({
  meals,
  recipes = [],
  onSaveMeal,
  onDeleteMeal,
  onAddMeal,
  onBatchSaveMeals,
  isMobile,
}) => {
  // Dynamically start at the current calendar week's Monday
  const [weekStartDate, setWeekStartDate] = useState<Date>(() => getCurrentWeekMonday());
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });

  // Modal state
  const [isChooseModalOpen, setIsChooseModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{
    day: DayInfo;
    mealType: MealType;
    currentMeal?: Meal;
  } | null>(null);

  // Subtle notice when a week is prefilled from previous week
  const [prefilledNotice, setPrefilledNotice] = useState<string | null>(null);

  // Compute 7 days of the current week (timezone safe)
  const weekDays = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);
  const selectedDay = weekDays[selectedDayIndex] || weekDays[0];

  // ISO string for week start: "YYYY-MM-DD"
  const weekStartStr = useMemo(() => formatDateToYYYYMMDD(weekStartDate), [weekStartDate]);

  const weekRangeLabel = useMemo(() => formatWeekRange(weekDays), [weekDays]);

  // Navigate to previous week
  const handlePrevWeek = () => {
    setWeekStartDate((prev) => getPreviousWeekMonday(prev));
  };

  // Navigate to next week
  const handleNextWeek = () => {
    setWeekStartDate((prev) => getNextWeekMonday(prev));
  };

  // Find meal for a specific date and meal type slot
  const findMealForSlot = (day: DayInfo, mealType: MealType): Meal | undefined => {
    return meals.find((m) => {
      if (m.meal_type !== mealType) return false;
      // 1. Direct date match (new & updated meals)
      if (m.date) {
        return m.date === day.date;
      }
      // 2. Fallback to week_start + day_of_week for seed data
      return m.week_start === weekStartStr && m.day_of_week === day.dayOfWeek;
    });
  };

  // Precompute comprehensive calorie totals for all 7 days of the week
  const weekDailyTotals = useMemo(() => {
    return weekDays.map((day) => {
      const bMeal = findMealForSlot(day, 'Breakfast');
      const lMeal = findMealForSlot(day, 'Lunch');
      const dMeal = findMealForSlot(day, 'Dinner');

      const bTotal: CategoryCalorieTotal = calculateCategoryCalories([bMeal], recipes);
      const lTotal: CategoryCalorieTotal = calculateCategoryCalories([lMeal], recipes);
      const dTotal: CategoryCalorieTotal = calculateCategoryCalories([dMeal], recipes);

      const dSummary: DailyCalorieTotal = calculateDailyCalories([bMeal], [lMeal], [dMeal], recipes);

      return {
        day,
        breakfastMeal: bMeal,
        lunchMeal: lMeal,
        dinnerMeal: dMeal,
        breakfastTotal: bTotal,
        lunchTotal: lTotal,
        dinnerTotal: dTotal,
        dailyTotal: dSummary,
      };
    });
  }, [weekDays, meals, recipes, weekStartStr]);

  const selectedDayCalorieData = weekDailyTotals[selectedDayIndex] || weekDailyTotals[0];

  // Precompute complete weekly calorie summary from all 7 daily totals
  const weeklyCalorieSummary: WeeklyCalorieTotal = useMemo(() => {
    const dailyTotals = weekDailyTotals.map((d) => d.dailyTotal);
    return calculateWeeklyCalories(dailyTotals);
  }, [weekDailyTotals]);

  // Weekly planner summary statistics (maintains backwards compatibility)
  const weeklyStats = useMemo(() => {
    return {
      plannedDays: weeklyCalorieSummary.plannedDaysCount,
      averageDaily: weeklyCalorieSummary.averageDailyCalories,
    };
  }, [weeklyCalorieSummary]);

  // Direct Dexie batch save fallback if onBatchSaveMeals prop not passed
  const handleBatchSaveFallback = async (newMeals: Meal[]) => {
    const clientId = syncEngine.getClientId();
    await db.transaction('rw', db.meals, db.outbox_operations, async () => {
      await db.meals.bulkPut(newMeals);
      for (const m of newMeals) {
        await enqueueOutboxOperation('meals', m.id, 'INSERT', { ...m }, clientId);
      }
    });

    if (onAddMeal) {
      newMeals.forEach((m) => onAddMeal(m));
    }

    if (syncEngine.isEffectivelyOnline()) {
      syncEngine.flushOutbox();
    }
  };

  // Automatic weekly meal plan prefill: When a new week begins, automatically prefill with previous week's plan
  useEffect(() => {
    let isCancelled = false;

    const checkAndPrefillNewWeek = async () => {
      // 1. If week already contains saved meals in state, mark initialized so it is never overwritten
      if (hasSavedMealsForWeek(weekStartStr, meals, weekDays)) {
        markWeekInitialized(weekStartStr);
        return;
      }

      // 2. If week was already initialized (e.g. user navigated away or cleared meals), never re-copy
      if (isWeekInitialized(weekStartStr)) {
        return;
      }

      // 3. Double-check Dexie directly to ensure no race condition with state loading
      let allMeals = meals;
      try {
        const dbMeals = await db.meals.toArray();
        if (dbMeals.length > 0) {
          allMeals = dbMeals;
        }
      } catch {
        // Fall back to meals prop
      }

      if (isCancelled) return;

      if (hasSavedMealsForWeek(weekStartStr, allMeals, weekDays)) {
        markWeekInitialized(weekStartStr);
        return;
      }

      // 4. Find previous week's meal plan
      const prevPlan = findPreviousWeekMeals(weekStartDate, allMeals);
      if (!prevPlan || prevPlan.meals.length === 0) {
        // No previous week exists -> start with existing empty/default planner behavior
        markWeekInitialized(weekStartStr);
        return;
      }

      // 5. Generate independent copy for the new week
      const copiedMeals = copyWeeklyMealPlan({
        sourceMeals: prevPlan.meals,
        sourceWeekDays: prevPlan.weekDays,
        targetWeekStartDate: weekStartDate,
      });

      if (copiedMeals.length === 0 || isCancelled) return;

      // Mark week as initialized immediately before saving to prevent duplicate executions
      markWeekInitialized(weekStartStr);
      setPrefilledNotice(`Prefilled with previous week's plan (${prevPlan.previousWeekStartStr})`);

      if (onBatchSaveMeals) {
        await onBatchSaveMeals(copiedMeals);
      } else {
        await handleBatchSaveFallback(copiedMeals);
      }
    };

    checkAndPrefillNewWeek();

    return () => {
      isCancelled = true;
    };
  }, [weekStartStr, weekStartDate, weekDays, meals, onBatchSaveMeals]);

  // Open the Choose Meal modal
  const handleOpenChooseMeal = (day: DayInfo, mealType: MealType, meal?: Meal) => {
    setActiveSlot({
      day,
      mealType,
      currentMeal: meal,
    });
    setIsChooseModalOpen(true);
  };

  // Direct Dexie update fallback if onSaveMeal prop not passed
  const handleSaveMealFallback = async (params: {
    existingMealId?: string;
    household_id: string;
    date: string;
    week_start: string;
    day_of_week: DayOfWeek;
    meal_type: MealType;
    title: string;
    image_url: string;
    recipe_id?: string;
    servings?: number;
    calories_per_serving?: number;
  }) => {
    const clientId = syncEngine.getClientId();
    if (params.existingMealId) {
      const existing = await db.meals.get(params.existingMealId);
      const updated: Meal = {
        ...(existing || {}),
        id: params.existingMealId,
        household_id: params.household_id,
        date: params.date,
        week_start: params.week_start,
        day_of_week: params.day_of_week,
        meal_type: params.meal_type,
        title: params.title,
        image_url: params.image_url,
        recipe_id: params.recipe_id,
        servings: params.servings !== undefined ? params.servings : (existing?.servings ?? 1),
        calories_per_serving:
          params.calories_per_serving !== undefined
            ? params.calories_per_serving
            : existing?.calories_per_serving,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      if (!params.recipe_id) {
        delete updated.recipe_id;
      }

      await db.transaction('rw', db.meals, db.outbox_operations, async () => {
        await db.meals.put(updated);
        await enqueueOutboxOperation('meals', updated.id, 'UPDATE', { ...updated }, clientId);
      });
    } else {
      const newMeal: Meal = {
        id: generateUUID(),
        household_id: params.household_id,
        date: params.date,
        week_start: params.week_start,
        day_of_week: params.day_of_week,
        meal_type: params.meal_type,
        title: params.title,
        image_url: params.image_url,
        recipe_id: params.recipe_id,
        servings: params.servings ?? 1,
        calories_per_serving: params.calories_per_serving,
        created_at: new Date().toISOString(),
      };
      if (!params.recipe_id) {
        delete newMeal.recipe_id;
      }

      await db.transaction('rw', db.meals, db.outbox_operations, async () => {
        await db.meals.put(newMeal);
        await enqueueOutboxOperation('meals', newMeal.id, 'INSERT', { ...newMeal }, clientId);
      });

      if (onAddMeal) {
        onAddMeal(newMeal);
      }
    }

    if (syncEngine.isEffectivelyOnline()) {
      syncEngine.flushOutbox();
    }
  };

  // Direct serving size update handler
  const handleUpdateServings = async (meal: Meal, newServings: number) => {
    const clamped = normalizeServingSize(newServings);
    const payload = {
      existingMealId: meal.id,
      household_id: meal.household_id,
      date: meal.date || weekStartStr,
      week_start: meal.week_start,
      day_of_week: meal.day_of_week,
      meal_type: meal.meal_type,
      title: meal.title,
      image_url: meal.image_url,
      recipe_id: meal.recipe_id,
      servings: clamped,
      calories_per_serving: meal.calories_per_serving,
    };

    if (onSaveMeal) {
      await onSaveMeal(payload);
    } else {
      await handleSaveMealFallback(payload);
    }
  };

  // Direct Dexie delete fallback
  const handleDeleteMealFallback = async (mealId: string) => {
    const clientId = syncEngine.getClientId();
    await db.transaction('rw', db.meals, db.outbox_operations, async () => {
      await db.meals.delete(mealId);
      await enqueueOutboxOperation('meals', mealId, 'DELETE', { id: mealId }, clientId);
    });

    if (syncEngine.isEffectivelyOnline()) {
      syncEngine.flushOutbox();
    }
  };

  // Handle meal selected from modal
  const handleSelectMeal = async (selected: {
    title: string;
    image_url: string;
    recipe_id?: string;
    servings?: number;
    calories_per_serving?: number;
  }) => {
    if (!activeSlot) return;
    const { day, mealType, currentMeal } = activeSlot;

    const titleToSave = selected.title.trim();
    let imageToSave = selected.image_url;

    // Canonical meal definition if matching catalog or saved recipe
    const resolvedMeal = getMealDefinition(selected, recipes);
    const isOldFallbackImage = Boolean(
      imageToSave &&
      imageToSave.includes('photo-1546833999-b9f581a1996d') &&
      !titleToSave.toLowerCase().includes('dal') &&
      !titleToSave.toLowerCase().includes('tadka')
    );

    if (resolvedMeal && resolvedMeal.id !== 'custom' && resolvedMeal.image && (!imageToSave || imageToSave === SAFE_FALLBACK_FOOD_IMAGE || isOldFallbackImage)) {
      imageToSave = resolvedMeal.image;
    } else if (!imageToSave || imageToSave === SAFE_FALLBACK_FOOD_IMAGE || isOldFallbackImage) {
      const cached = getCachedMealImage(titleToSave);
      if (cached && cached !== SAFE_FALLBACK_FOOD_IMAGE && !cached.includes('photo-1546833999-b9f581a1996d')) {
        imageToSave = cached;
      }
    }

    // Determine calories per serving
    let caloriesPerServingToSave = selected.calories_per_serving;
    if (caloriesPerServingToSave === undefined) {
      const matchedRecipe = recipes.find(
        (r) => r.id === selected.recipe_id || r.title.toLowerCase().trim() === titleToSave.toLowerCase()
      );
      if (matchedRecipe && matchedRecipe.calories_per_serving !== undefined && matchedRecipe.calories_per_serving !== null) {
        caloriesPerServingToSave = matchedRecipe.calories_per_serving;
      } else {
        const dishNut = lookupDishNutrition(titleToSave);
        if (dishNut) {
          caloriesPerServingToSave = dishNut.caloriesPerServing;
        } else if (currentMeal?.calories_per_serving !== undefined) {
          caloriesPerServingToSave = currentMeal.calories_per_serving;
        }
      }
    }

    // Clear previous meal's recipe_id if custom meal
    const recipeIdToSave = resolvedMeal && resolvedMeal.id !== 'custom' ? (resolvedMeal.recipeId || resolvedMeal.id) : selected.recipe_id;

    const payload = {
      existingMealId: currentMeal?.id,
      household_id: currentMeal?.household_id || 'h_default_household_01',
      date: day.date,
      week_start: weekStartStr,
      day_of_week: day.dayOfWeek,
      meal_type: mealType,
      title: titleToSave,
      image_url: imageToSave || SAFE_FALLBACK_FOOD_IMAGE,
      recipe_id: recipeIdToSave,
      servings: selected.servings ?? currentMeal?.servings ?? 1,
      calories_per_serving: caloriesPerServingToSave,
    };

    if (onSaveMeal) {
      await onSaveMeal(payload);
    } else {
      await handleSaveMealFallback(payload);
    }

    setIsChooseModalOpen(false);
    setActiveSlot(null);

    // If image is missing or fallback, asynchronously resolve and update meal
    if (!imageToSave || imageToSave === SAFE_FALLBACK_FOOD_IMAGE || isOldFallbackImage) {
      resolveMealImage(titleToSave, recipes).then((resolvedUrl) => {
        if (resolvedUrl && resolvedUrl !== SAFE_FALLBACK_FOOD_IMAGE && !resolvedUrl.includes('photo-1546833999-b9f581a1996d')) {
          const updatePayload = {
            ...payload,
            image_url: resolvedUrl,
          };
          if (onSaveMeal) {
            onSaveMeal(updatePayload);
          } else {
            handleSaveMealFallback(updatePayload);
          }
        }
      }).catch(() => {});
    }
  };

  // Resolve missing or temporary fallback images and unassigned nutrition asynchronously without blocking render
  React.useEffect(() => {
    const handleResolveMissingMetadata = () => {
      meals.forEach((m) => {
        const isMealOldFallback = Boolean(
          m.image_url &&
          m.image_url.includes('photo-1546833999-b9f581a1996d') &&
          !m.title.toLowerCase().includes('dal') &&
          !m.title.toLowerCase().includes('tadka')
        );

        const needsImage = m.title && (!m.image_url || m.image_url === SAFE_FALLBACK_FOOD_IMAGE || isMealOldFallback);
        const needsNutrition = m.title && m.calories_per_serving === undefined;

        if (needsNutrition) {
          const dishNut = lookupDishNutrition(m.title);
          if (dishNut) {
            const updatePayload = {
              existingMealId: m.id,
              household_id: m.household_id,
              date: m.date || weekStartStr,
              week_start: m.week_start,
              day_of_week: m.day_of_week,
              meal_type: m.meal_type,
              title: m.title,
              image_url: m.image_url || SAFE_FALLBACK_FOOD_IMAGE,
              recipe_id: m.recipe_id,
              servings: m.servings ?? 1,
              calories_per_serving: dishNut.caloriesPerServing,
            };
            if (onSaveMeal) onSaveMeal(updatePayload);
            else handleSaveMealFallback(updatePayload);
          }
        }

        if (needsImage) {
          const cached = getCachedMealImage(m.title);
          if (cached && cached !== SAFE_FALLBACK_FOOD_IMAGE && !cached.includes('photo-1546833999-b9f581a1996d')) {
            const updatePayload = {
              existingMealId: m.id,
              household_id: m.household_id,
              date: m.date || weekStartStr,
              week_start: m.week_start,
              day_of_week: m.day_of_week,
              meal_type: m.meal_type,
              title: m.title,
              image_url: cached,
              recipe_id: m.recipe_id,
              servings: m.servings ?? 1,
              calories_per_serving: m.calories_per_serving,
            };
            if (onSaveMeal) onSaveMeal(updatePayload);
            else handleSaveMealFallback(updatePayload);
          } else if (typeof navigator === 'undefined' || navigator.onLine) {
            resolveMealImage(m.title, recipes).then((resolvedUrl) => {
              if (resolvedUrl && resolvedUrl !== SAFE_FALLBACK_FOOD_IMAGE && !resolvedUrl.includes('photo-1546833999-b9f581a1996d')) {
                const updatePayload = {
                  existingMealId: m.id,
                  household_id: m.household_id,
                  date: m.date || weekStartStr,
                  week_start: m.week_start,
                  day_of_week: m.day_of_week,
                  meal_type: m.meal_type,
                  title: m.title,
                  image_url: resolvedUrl,
                  recipe_id: m.recipe_id,
                  servings: m.servings ?? 1,
                  calories_per_serving: m.calories_per_serving,
                };
                if (onSaveMeal) onSaveMeal(updatePayload);
                else handleSaveMealFallback(updatePayload);
              }
            }).catch(() => {});
          }
        }
      });
    };

    handleResolveMissingMetadata();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleResolveMissingMetadata);
      return () => window.removeEventListener('online', handleResolveMissingMetadata);
    }
  }, [meals, recipes, weekStartStr]);

  // Handle remove meal from modal
  const handleRemoveMeal = async () => {
    if (!activeSlot?.currentMeal) return;
    const mealId = activeSlot.currentMeal.id;

    if (onDeleteMeal) {
      await onDeleteMeal(mealId);
    } else {
      await handleDeleteMealFallback(mealId);
    }

    setIsChooseModalOpen(false);
    setActiveSlot(null);
  };

  // ----------------------------------------------------
  // SUB-LAYOUT: Clean Week Navigation Header Pill
  // ----------------------------------------------------
  const renderWeekNav = () => (
    <div
      className={`meal-date-selector flex items-center justify-between ${
        isMobile ? '' : 'md:justify-start md:gap-2 md:w-auto md:max-w-none md:mx-0'
      } gap-1 bg-white px-1.5 xs:px-2 py-1.5 rounded-2xl border border-borderWarm shadow-subtle w-full max-w-sm mx-auto shrink-0`}
    >
      <button
        type="button"
        onClick={handlePrevWeek}
        aria-label="Previous week"
        className="w-9 h-9 xs:w-11 xs:h-11 min-w-[36px] xs:min-w-[44px] min-h-[36px] xs:min-h-[44px] flex items-center justify-center text-ink-600 hover:text-ink-900 rounded-xl hover:bg-cream-100 active:scale-95 transition-all cursor-pointer shrink-0"
      >
        <ChevronLeft className="w-5 h-5 stroke-[2]" />
      </button>

      <div
        className={`flex items-center justify-center gap-1 xs:gap-1.5 flex-1 ${
          isMobile ? '' : 'md:flex-initial'
        } px-1 xs:px-2 text-center select-none overflow-hidden min-w-0`}
      >
        <Calendar className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-terracotta-500 shrink-0 hidden xs:inline" />
        <span
          className={`font-serif text-xs xs:text-sm ${
            isMobile ? '' : 'md:text-base'
          } font-medium text-ink-900 truncate`}
        >
          {weekRangeLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={handleNextWeek}
        aria-label="Next week"
        className="w-9 h-9 xs:w-11 xs:h-11 min-w-[36px] xs:min-w-[44px] min-h-[36px] xs:min-h-[44px] flex items-center justify-center text-ink-600 hover:text-ink-900 rounded-xl hover:bg-cream-100 active:scale-95 transition-all cursor-pointer shrink-0"
      >
        <ChevronRight className="w-5 h-5 stroke-[2]" />
      </button>
    </div>
  );

  // ----------------------------------------------------
  // SUB-LAYOUT: Total Weekly Calories Summary Component
  // Placed at bottom of 7-day planner (mobile and desktop)
  // ----------------------------------------------------
  const renderWeeklyCalorieSummary = () => {
    return (
      <div
        id="weekly-calorie-summary"
        className="weekly-calorie-summary mt-6 xs:mt-8 p-3.5 xs:p-4 sm:p-5 rounded-2xl bg-cream-100 border border-borderWarm shadow-subtle space-y-3.5 mb-8"
      >
        {/* Section 1: Header (Title, Icon, Range) */}
        <div className="flex items-center gap-2.5 pb-3 border-b border-borderWarm/70">
          <div className="w-9 h-9 xs:w-10 xs:h-10 rounded-xl bg-terracotta-500 text-white flex items-center justify-center shadow-subtle shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-base xs:text-lg sm:text-xl font-semibold text-ink-900 leading-tight">
              Total Weekly Calories
            </h3>
            <p className="text-[10px] xs:text-xs text-ink-500 font-serif italic mt-0.5 truncate">
              Complete 7-day nutritional summary • {weekRangeLabel}
            </p>
          </div>
        </div>

        {/* Section 2: Prominent Weekly Calorie Hero Box */}
        <div className="p-3 xs:p-4 rounded-xl bg-white border border-borderWarm/80 shadow-subtle space-y-2">
          {/* Calorie Value & Status Badge Row */}
          <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[9px] xs:text-[10px] uppercase tracking-wider font-semibold text-ink-500 block">
                7-Day Total
              </span>
              <span
                id="weekly-calories-value"
                className="font-mono text-2xl xs:text-3xl sm:text-4xl font-bold text-terracotta-700 block leading-tight tracking-tight mt-0.5"
              >
                {weeklyCalorieSummary.totalCalories > 0
                  ? `${weeklyCalorieSummary.totalCalories.toLocaleString()}${weeklyCalorieSummary.hasUnavailable ? '+' : ''} kcal`
                  : weeklyCalorieSummary.formattedText}
              </span>
            </div>

            {/* Status Pill Badge */}
            <div className="flex items-center gap-1.5 self-start xs:self-center shrink-0">
              {weeklyCalorieSummary.hasUnavailable ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Incomplete ({weeklyCalorieSummary.unavailableCount} missing)
                </span>
              ) : weeklyCalorieSummary.totalMealCount > 0 ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium">
                  Complete Plan ({weeklyCalorieSummary.totalMealCount} meals)
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-cream-100 border border-borderWarm text-ink-500 text-[11px] font-medium">
                  No meals
                </span>
              )}
            </div>
          </div>

          {/* Supporting Info: Planned Meals Count + Average per day */}
          <div className="pt-2 border-t border-borderWarm/60 flex flex-wrap items-center justify-between gap-1.5 text-xs text-ink-600">
            <span className="text-[11px] text-ink-600 font-sans">
              {weeklyCalorieSummary.totalMealCount > 0
                ? `${weeklyCalorieSummary.totalMealCount} meals across ${weeklyCalorieSummary.plannedDaysCount} days`
                : 'No meals planned this week'}
            </span>
            {weeklyCalorieSummary.averageDailyCalories && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cream-50 border border-borderWarm font-mono text-[11px] text-terracotta-700 font-medium">
                Avg ~{weeklyCalorieSummary.averageDailyCalories.toLocaleString()} kcal/day
              </span>
            )}
          </div>
        </div>

        {/* Section 3: 7-Day Mini Contribution Strip (Mobile touch-friendly) */}
        <div>
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1.5">
            Daily Contributions
          </span>
          <div className="grid grid-cols-7 gap-1 xs:gap-1.5 text-center">
            {weekDailyTotals.map((item, idx) => {
              const day = item.day;
              const daySummary = item.dailyTotal;
              const hasMeals = daySummary.totalMealCount > 0;
              const isSelected = selectedDayIndex === idx;

              // Format short calorie indicator for compact 7-col pills
              const shortCal =
                daySummary.totalCalories > 0
                  ? daySummary.totalCalories >= 1000
                    ? `${(daySummary.totalCalories / 1000).toFixed(1)}k`
                    : `${daySummary.totalCalories}`
                  : '—';

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`p-1 xs:p-1.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col items-center justify-center min-w-0 ${
                    isSelected
                      ? 'bg-terracotta-500 text-white border-terracotta-500 shadow-subtle'
                      : 'bg-white text-ink-800 border-borderWarm hover:border-terracotta-300 hover:bg-cream-50'
                  }`}
                  title={`${day.formattedLong}: ${daySummary.formattedText}`}
                >
                  <span
                    className={`text-[8px] xs:text-[9px] font-semibold uppercase block truncate w-full ${
                      isSelected ? 'text-cream-100' : 'text-ink-500'
                    }`}
                  >
                    {day.dayOfWeek}
                  </span>
                  <span
                    className={`text-[9px] xs:text-[11px] font-serif font-bold block truncate mt-0.5 ${
                      isSelected ? 'text-white' : 'text-ink-900'
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  <span
                    className={`text-[8px] xs:text-[9px] font-mono mt-0.5 block truncate w-full ${
                      isSelected
                        ? 'text-white font-medium'
                        : hasMeals
                        ? 'text-terracotta-700 font-semibold'
                        : 'text-ink-400'
                    }`}
                  >
                    {shortCal}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 4: 3 Meal Category Totals across the full week */}
        <div>
          <span className="text-[9px] xs:text-[10px] uppercase tracking-wider font-semibold text-ink-500 block mb-1.5">
            Weekly Category Totals
          </span>
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-1.5 xs:gap-2">
            <div className="bg-white px-3 py-2 xs:py-2.5 rounded-xl border border-borderWarm/70 flex items-center justify-between xs:flex-col xs:justify-center xs:text-center min-w-0">
              <span className="text-[10px] xs:text-[10px] text-ink-500 uppercase tracking-wider">
                Breakfast
              </span>
              <span
                className="font-mono text-xs xs:text-xs sm:text-sm font-semibold text-ink-900 xs:mt-0.5 truncate"
                title={`Weekly Breakfast Total: ${weeklyCalorieSummary.breakfastTotalCalories.toLocaleString()} kcal`}
              >
                {weeklyCalorieSummary.breakfastTotalCalories > 0
                  ? `${weeklyCalorieSummary.breakfastTotalCalories.toLocaleString()} kcal`
                  : '—'}
              </span>
            </div>
            <div className="bg-white px-3 py-2 xs:py-2.5 rounded-xl border border-borderWarm/70 flex items-center justify-between xs:flex-col xs:justify-center xs:text-center min-w-0">
              <span className="text-[10px] xs:text-[10px] text-ink-500 uppercase tracking-wider">
                Lunch
              </span>
              <span
                className="font-mono text-xs xs:text-xs sm:text-sm font-semibold text-ink-900 xs:mt-0.5 truncate"
                title={`Weekly Lunch Total: ${weeklyCalorieSummary.lunchTotalCalories.toLocaleString()} kcal`}
              >
                {weeklyCalorieSummary.lunchTotalCalories > 0
                  ? `${weeklyCalorieSummary.lunchTotalCalories.toLocaleString()} kcal`
                  : '—'}
              </span>
            </div>
            <div className="bg-white px-3 py-2 xs:py-2.5 rounded-xl border border-borderWarm/70 flex items-center justify-between xs:flex-col xs:justify-center xs:text-center min-w-0">
              <span className="text-[10px] xs:text-[10px] text-ink-500 uppercase tracking-wider">
                Dinner
              </span>
              <span
                className="font-mono text-xs xs:text-xs sm:text-sm font-semibold text-ink-900 xs:mt-0.5 truncate"
                title={`Weekly Dinner Total: ${weeklyCalorieSummary.dinnerTotalCalories.toLocaleString()} kcal`}
              >
                {weeklyCalorieSummary.dinnerTotalCalories > 0
                  ? `${weeklyCalorieSummary.dinnerTotalCalories.toLocaleString()} kcal`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Missing Nutrition Warning Box */}
        {weeklyCalorieSummary.hasUnavailable && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              Notice: Total Weekly Calories is incomplete because {weeklyCalorieSummary.unavailableCount} planned meal(s) have unavailable nutrition data. Missing meals are not counted as zero calories.
            </span>
          </div>
        )}

        <p className="text-[10px] text-ink-400 italic text-center sm:text-left leading-normal">
          Weekly calories are the sum of all 7 daily totals. Values estimated from verified recipes, ICMR-NIN & USDA nutritional standards.
        </p>
      </div>
    );
  };

  // ----------------------------------------------------
  // SUB-LAYOUT: Mobile Layout (Mobile-first, 320px - 430px)
  // Stack: Meal Cards → Meal-Category Calorie Total → Daily Calorie Summary → Weekly Calorie Summary
  // ----------------------------------------------------
  const renderMobileLayout = () => {
    const { breakfastTotal, lunchTotal, dinnerTotal, dailyTotal } = selectedDayCalorieData;

    return (
      <div className="space-y-4 xs:space-y-5 animate-fadeIn pb-12">
        {/* Horizontal Scrollable Day Strip with Daily Calorie Totals */}
        <div>
          <div className="flex gap-1.5 xs:gap-2 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-none snap-x snap-mandatory">
            {weekDailyTotals.map((item, idx) => {
              const isSelected = selectedDayIndex === idx;
              const day = item.day;
              const daySummary = item.dailyTotal;
              const hasMeals = daySummary.totalMealCount > 0;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`snap-start shrink-0 min-w-[72px] xs:min-w-[80px] sm:min-w-[84px] py-2 xs:py-2.5 px-1.5 xs:px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border relative select-none ${
                    isSelected
                      ? 'bg-terracotta-500 text-white border-terracotta-500 shadow-card scale-[1.02]'
                      : 'bg-white text-ink-800 border-borderWarm hover:border-terracotta-300 hover:bg-cream-50'
                  }`}
                >
                  <span
                    className={`text-[9px] xs:text-[10px] font-semibold tracking-wider uppercase block ${
                      isSelected ? 'text-cream-100' : 'text-ink-500'
                    }`}
                  >
                    {day.dayOfWeek}
                  </span>
                  <span
                    className={`font-serif text-xs xs:text-sm font-semibold mt-0.5 block ${
                      isSelected ? 'text-white' : 'text-ink-900'
                    }`}
                  >
                    {day.monthShort} {day.dayNumber}
                  </span>

                  {/* Daily Calorie Total on Day Pill - compactText prevents awkward clipping */}
                  <span
                    className={`text-[9px] xs:text-[10px] font-mono mt-1 px-1 xs:px-1.5 py-0.5 rounded-full block whitespace-nowrap max-w-full truncate ${
                      isSelected
                        ? 'bg-white/20 text-white font-medium'
                        : hasMeals
                        ? 'bg-cream-100 text-terracotta-700 font-medium'
                        : 'text-ink-400'
                    }`}
                    title={hasMeals ? daySummary.formattedText : undefined}
                  >
                    {hasMeals ? (daySummary.compactText || daySummary.formattedText) : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Header & Calorie Badge */}
        <div className="space-y-3 xs:space-y-4">
          <div className="pb-2 border-b border-borderWarm-subtle flex items-start sm:items-baseline justify-between gap-2 flex-wrap">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-lg xs:text-xl sm:text-2xl font-medium text-ink-900 truncate">
                {selectedDay.formattedLong}
              </h2>
              <p className="font-serif italic text-xs text-ink-500 mt-0.5 font-normal">
                Breakfast, Lunch, and Dinner
              </p>
            </div>

            {/* Daily Total Summary Badge at top of Day */}
            <div className="flex items-center gap-1.5 bg-white px-2 xs:px-2.5 py-1 rounded-xl border border-borderWarm shadow-subtle shrink-0">
              <Flame className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
              <div className="text-right">
                <span className="font-mono text-xs font-semibold text-terracotta-700">
                  {dailyTotal.compactText || dailyTotal.formattedText}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Meal Sections: Breakfast, Lunch, Dinner */}
          <div className="space-y-3 xs:space-y-4">
            {MEAL_TYPES.map((type) => {
              const meal = findMealForSlot(selectedDay, type);
              const selectedMeal = meal ? getMealDefinition(meal, recipes) : undefined;
              const displayTitle = meal?.title || selectedMeal?.name || 'Meal';
              const displayImage = meal?.image_url || selectedMeal?.image || SAFE_FALLBACK_FOOD_IMAGE;
              const displayCategory = selectedMeal?.category || type;
              const displayPrepTime = selectedMeal?.preparationTime;

              const calResult = calculateMealCalories(meal, recipes);
              const currentServings = meal ? normalizeServingSize(meal.servings) : 1;

              const categoryTotal: CategoryCalorieTotal =
                type === 'Breakfast'
                  ? breakfastTotal
                  : type === 'Lunch'
                  ? lunchTotal
                  : dinnerTotal;

              return (
                <div key={type} className="space-y-2 bg-cream-50/70 p-2.5 xs:p-3 rounded-2xl border border-borderWarm/80">
                  {/* Category Header */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className="font-serif text-sm font-semibold text-ink-900">
                      {type}
                    </span>
                    {meal && (
                      <button
                        type="button"
                        onClick={() => handleOpenChooseMeal(selectedDay, type, meal)}
                        className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {/* Meal Card Graphic */}
                  {meal ? (
                    <div className="space-y-2">
                      <div
                        onClick={() => handleOpenChooseMeal(selectedDay, type, meal)}
                        className="group bg-white rounded-xl border border-borderWarm p-2.5 xs:p-3 shadow-subtle hover:border-terracotta-300 transition-all cursor-pointer flex items-center gap-2.5 xs:gap-3 active:bg-cream-50"
                      >
                        <img
                          src={displayImage}
                          alt={displayTitle}
                          className="w-12 h-12 xs:w-14 xs:h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-borderWarm shrink-0 group-hover:scale-105 transition-transform duration-200"
                        />

                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] xs:text-[10px] uppercase tracking-wider text-terracotta-600 font-semibold block">
                              {displayCategory}
                            </span>
                            {displayPrepTime && (
                              <span className="text-[9px] xs:text-[10px] text-ink-400 font-mono">
                                • {displayPrepTime}
                              </span>
                            )}
                          </div>
                          <h3 className="font-serif text-sm sm:text-base font-medium text-ink-900 line-clamp-2 break-words group-hover:text-terracotta-600 transition-colors">
                            {displayTitle}
                          </h3>
                          <span className="text-[10px] xs:text-[11px] text-ink-500 mt-0.5 block">
                            Tap to change or remove
                          </span>
                        </div>
                      </div>

                      {/* Estimated Calories & Serving Controls Directly Below Individual Meal Card */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 xs:gap-2 px-2.5 py-1.5 bg-white/90 rounded-xl border border-borderWarm/70 text-xs">
                        {calResult.calories !== null ? (
                          <div
                            className="flex items-center gap-1 min-w-0"
                            title={calResult.details || `Estimated ${calResult.calories} kcal`}
                          >
                            <Flame className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                            <span className="font-mono font-semibold text-terracotta-700 text-xs truncate">
                              ~{calResult.calories} kcal
                            </span>
                            <span className="text-[10px] text-ink-500 font-sans hidden xs:inline shrink-0">
                              ({currentServings} {currentServings === 1 ? 'serving' : 'servings'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-ink-400 truncate" title="Reliable data unavailable">
                            Calories unavailable
                          </span>
                        )}

                        {/* Mobile-Friendly Serving Size Stepper */}
                        <div className="flex items-center gap-0.5 xs:gap-1 bg-cream-100 rounded-lg px-1.5 xs:px-2 py-0.5 border border-borderWarm shrink-0 select-none ml-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateServings(meal, currentServings <= 1 ? 0.5 : currentServings - 1);
                            }}
                            disabled={currentServings <= 0.5}
                            aria-label="Decrease serving size"
                            className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center font-bold text-ink-700 hover:text-ink-900 disabled:opacity-25 rounded-md hover:bg-cream-200 active:scale-95 cursor-pointer text-sm"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs font-semibold text-ink-800 min-w-[24px] text-center">
                            {currentServings}s
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateServings(meal, currentServings < 1 ? 1 : currentServings + 1);
                            }}
                            disabled={currentServings >= 12}
                            aria-label="Increase serving size"
                            className="w-7 h-7 min-w-[28px] min-h-[28px] flex items-center justify-center font-bold text-ink-700 hover:text-ink-900 disabled:opacity-25 rounded-md hover:bg-cream-200 active:scale-95 cursor-pointer text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenChooseMeal(selectedDay, type)}
                      className="w-full h-14 rounded-xl border border-dashed border-borderWarm hover:border-terracotta-400 bg-white/60 hover:bg-white flex items-center justify-center gap-2 text-ink-500 hover:text-terracotta-600 transition-all cursor-pointer text-xs font-medium active:scale-[0.99]"
                    >
                      <Plus className="w-4 h-4 stroke-[1.7]" />
                      <span>Add {type}</span>
                    </button>
                  )}

                  {/* Requirement 2: Display separate category total directly beneath each meal category */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-white border border-borderWarm/70 text-xs shadow-subtle">
                    <span className="font-serif font-medium text-ink-700">
                      {type} Total:
                    </span>
                    <span className="font-mono font-semibold text-ink-900">
                      {categoryTotal.formattedText}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Requirement 3: Total Daily Calories Summary below Breakfast, Lunch, and Dinner */}
          <div className="p-3.5 xs:p-4 rounded-2xl bg-cream-100 border border-borderWarm shadow-subtle space-y-3">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-terracotta-500 text-white flex items-center justify-center shadow-subtle shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-sm xs:text-base font-semibold text-ink-900">
                    Total Daily Calories
                  </h3>
                  <p className="text-[10px] xs:text-[11px] text-ink-500 font-sans">
                    {selectedDay.formattedLong}
                  </p>
                </div>
              </div>
              <div className="text-left xs:text-right">
                <span className="font-mono text-lg xs:text-xl sm:text-2xl font-bold text-terracotta-700 block leading-tight">
                  {dailyTotal.totalCalories > 0
                    ? `${dailyTotal.totalCalories.toLocaleString()}${dailyTotal.hasUnavailable ? '+' : ''} kcal`
                    : dailyTotal.formattedText}
                </span>
                {dailyTotal.hasUnavailable ? (
                  <span className="text-[10px] xs:text-[11px] text-amber-700 font-medium block mt-0.5">
                    *Incomplete Total — {dailyTotal.unavailableCount} meal missing nutrition
                  </span>
                ) : dailyTotal.totalMealCount > 0 ? (
                  <span className="text-[10px] xs:text-[11px] text-ink-500 font-sans block mt-0.5">
                    {dailyTotal.totalMealCount} meals planned
                  </span>
                ) : null}
              </div>
            </div>

            {/* Category Calorie Contribution Breakdown */}
            <div className="grid grid-cols-3 gap-1.5 xs:gap-2 pt-2 border-t border-borderWarm/70 text-center">
              <div className="bg-white p-1.5 xs:p-2 rounded-xl border border-borderWarm/70 min-w-0">
                <span className="text-[9px] xs:text-[10px] text-ink-500 uppercase tracking-wider block">Breakfast</span>
                <span className="font-mono text-[11px] xs:text-xs font-semibold text-ink-900 mt-0.5 block truncate" title={breakfastTotal.formattedText}>
                  {breakfastTotal.compactText || breakfastTotal.formattedText}
                </span>
              </div>
              <div className="bg-white p-1.5 xs:p-2 rounded-xl border border-borderWarm/70 min-w-0">
                <span className="text-[9px] xs:text-[10px] text-ink-500 uppercase tracking-wider block">Lunch</span>
                <span className="font-mono text-[11px] xs:text-xs font-semibold text-ink-900 mt-0.5 block truncate" title={lunchTotal.formattedText}>
                  {lunchTotal.compactText || lunchTotal.formattedText}
                </span>
              </div>
              <div className="bg-white p-1.5 xs:p-2 rounded-xl border border-borderWarm/70 min-w-0">
                <span className="text-[9px] xs:text-[10px] text-ink-500 uppercase tracking-wider block">Dinner</span>
                <span className="font-mono text-[11px] xs:text-xs font-semibold text-ink-900 mt-0.5 block truncate" title={dinnerTotal.formattedText}>
                  {dinnerTotal.compactText || dinnerTotal.formattedText}
                </span>
              </div>
            </div>

            {/* Missing Calorie Data Warning */}
            {dailyTotal.hasUnavailable && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Notice: Daily calorie total is incomplete because {dailyTotal.unavailableCount} meal has unavailable nutrition data.
                </span>
              </div>
            )}

            <p className="text-[10px] text-ink-400 italic">
              Estimated calories calculated from recipe nutrition and serving sizes.
            </p>
          </div>
        </div>

        {/* Complete Seven-Day Weekly Calorie Summary */}
        {renderWeeklyCalorieSummary()}
      </div>
    );
  };

  // ----------------------------------------------------
  // SUB-LAYOUT: Desktop Weekly Grid Layout (Preserves 7-Day Matrix)
  // Meal Rows → Category Totals directly beneath rows → Daily Total Row
  // ----------------------------------------------------
  const renderDesktopLayout = () => (
    <div className="overflow-x-auto pb-6 animate-fadeIn">
      <div className="min-w-[880px] space-y-4">
        {/* Column Headers with Day Info & Independent Daily Calories */}
        <div className="grid grid-cols-8 gap-3 items-center">
          <div className="text-xs font-serif italic text-ink-500 font-medium pl-1">
            Meals & Calorie Plan
          </div>
          {weekDailyTotals.map((item) => {
            const day = item.day;
            const dayDaily = item.dailyTotal;
            const hasMeals = dayDaily.totalMealCount > 0;

            return (
              <div
                key={day.date}
                className="text-center py-2 px-1.5 rounded-xl bg-cream-50 border border-borderWarm flex flex-col items-center justify-center min-h-[58px]"
              >
                <span className="font-serif text-sm font-semibold text-ink-900 block">
                  {day.dayOfWeek}
                </span>
                <span className="text-[11px] text-ink-500 font-mono">
                  {day.monthShort} {day.dayNumber}
                </span>
                {hasMeals && (
                  <span
                    className="text-[10px] font-mono text-terracotta-700 font-medium mt-0.5 truncate max-w-full"
                    title={`Daily total: ${dayDaily.formattedText}`}
                  >
                    {dayDaily.formattedText}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Rows for Breakfast, Lunch, Dinner with Individual Calories & Category Totals */}
        {MEAL_TYPES.map((type) => {
          return (
            <div key={type} className="space-y-1.5 bg-cream-50/50 p-2.5 rounded-2xl border border-borderWarm/60">
              {/* Row 1: Meal Cards for Category */}
              <div className="grid grid-cols-8 gap-3 items-start">
                <div className="font-serif text-sm font-semibold text-ink-900 pr-2 pl-1 pt-2">
                  {type}
                </div>
                {weekDays.map((day) => {
                  const meal = findMealForSlot(day, type);
                  return (
                    <MealCard
                      key={`${day.date}-${type}`}
                      meal={meal}
                      day={day.dayOfWeek}
                      mealType={type}
                      recipes={recipes}
                      onAddMealClick={() => handleOpenChooseMeal(day, type)}
                      onMealClick={() => handleOpenChooseMeal(day, type, meal)}
                      onServingChange={handleUpdateServings}
                    />
                  );
                })}
              </div>

              {/* Row 2: Category Calorie Total Row directly beneath meal cards */}
              <div className="grid grid-cols-8 gap-3 items-center pt-1 border-t border-borderWarm/40">
                <div className="font-serif text-xs font-medium text-ink-600 pl-1">
                  {type} Total
                </div>
                {weekDailyTotals.map((item) => {
                  const categoryTotal =
                    type === 'Breakfast'
                      ? item.breakfastTotal
                      : type === 'Lunch'
                      ? item.lunchTotal
                      : item.dinnerTotal;

                  return (
                    <div
                      key={`total-${item.day.date}-${type}`}
                      className="py-1 px-1.5 rounded-lg bg-cream-100/80 border border-borderWarm text-center text-xs font-mono font-medium text-ink-800 truncate"
                      title={`${item.day.dayOfWeek} ${type} Total: ${categoryTotal.formattedText}`}
                    >
                      {categoryTotal.formattedText}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Row 3: Total Daily Calories Summary Row (Breakfast + Lunch + Dinner) */}
        <div className="grid grid-cols-8 gap-3 items-center p-2.5 rounded-2xl bg-cream-100 border border-borderWarm shadow-subtle">
          <div className="pr-2 pl-1 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-terracotta-500 shrink-0" />
            <div>
              <span className="font-serif text-sm font-semibold text-ink-900 block leading-tight">
                Daily Total
              </span>
              <span className="text-[10px] text-ink-500 font-sans block">
                Total Calories
              </span>
            </div>
          </div>
          {weekDailyTotals.map((item) => {
            const daily = item.dailyTotal;
            return (
              <div
                key={`daily-total-${item.day.date}`}
                className="py-2 px-1 rounded-xl bg-white border border-terracotta-300 text-center shadow-subtle"
              >
                <span
                  className="font-mono text-xs font-bold text-terracotta-700 block truncate"
                  title={`Daily Total: ${daily.formattedText}`}
                >
                  {daily.formattedText}
                </span>
                {daily.hasUnavailable && (
                  <span className="text-[9px] text-amber-700 font-sans block truncate" title="Incomplete total">
                    *Incomplete
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Complete Seven-Day Weekly Calorie Summary */}
        {renderWeeklyCalorieSummary()}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3.5 xs:px-4 sm:px-8 py-5 xs:py-6 sm:py-8 animate-fadeIn">
      {/* Header with Title & Date Navigation */}
      <div
        className={`meal-planner-header flex flex-col ${
          isMobile ? '' : 'md:flex-row md:items-end'
        } justify-between gap-4 pb-5 mb-6 border-b border-borderWarm`}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
              Meal Planner
            </h1>
            {weeklyStats.averageDaily && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-cream-100 border border-borderWarm text-xs font-mono text-terracotta-700">
                <Flame className="w-3.5 h-3.5 text-terracotta-500" />
                Avg: ~{weeklyStats.averageDaily.toLocaleString()} kcal/day
              </span>
            )}
          </div>
          <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1 font-normal">
            Plan better meals. Track calories with ease. Waste less.
          </p>
        </div>

        {/* Clean Week selector pill */}
        {renderWeekNav()}
      </div>

      {/* Notice if new week was prefilled from previous week */}
      {prefilledNotice && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-cream-50 border border-terracotta-200 text-terracotta-900 text-xs shadow-subtle mb-5 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 text-terracotta-600 shrink-0" />
            <span className="truncate">
              {prefilledNotice} — you can customize, add, or remove meals independently.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPrefilledNotice(null)}
            className="text-terracotta-600 hover:text-terracotta-800 text-sm font-bold px-1.5 py-0.5 rounded-md hover:bg-cream-100 cursor-pointer shrink-0"
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}

      {/* Responsive Viewport Switcher */}
      {isMobile === true ? (
        renderMobileLayout()
      ) : isMobile === false ? (
        renderDesktopLayout()
      ) : (
        <>
          <div className="block md:hidden">{renderMobileLayout()}</div>
          <div className="hidden md:block">{renderDesktopLayout()}</div>
        </>
      )}

      {/* Choose Meal Modal / Sheet */}
      {activeSlot && (
        <ChooseMealModal
          isOpen={isChooseModalOpen}
          onClose={() => {
            setIsChooseModalOpen(false);
            setActiveSlot(null);
          }}
          day={activeSlot.day}
          mealType={activeSlot.mealType}
          currentMeal={activeSlot.currentMeal}
          recipes={recipes}
          onSelectMeal={handleSelectMeal}
          onRemoveMeal={activeSlot.currentMeal ? handleRemoveMeal : undefined}
        />
      )}
    </div>
  );
};
