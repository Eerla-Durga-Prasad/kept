import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Recipe, Meal, MealType } from '../sync/types';
import { X, Search, Clock, Trash2, Plus, Check, Flame, Loader2, Sparkles } from 'lucide-react';
import {
  lookupDishNutrition,
  findNutritionCandidates,
  resolveMealNutritionAsync,
  setCachedDishNutrition,
  normalizeServingSize,
  NutritionItem,
} from '../lib/calorieCalculator';

export interface DayInfo {
  date: string; // YYYY-MM-DD
  dayOfWeek: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  dayName: string;
  monthShort: string;
  dayNumber: number;
  formattedHeader: string;
  formattedLong: string;
}

import { MEAL_CATALOG } from '../lib/mealCatalog';

export interface AvailableDish {
  id: string;
  name: string;
  category: string;
  prepTime: string;
  image: string;
  recipeId?: string;
  mealTypeHint?: MealType;
}

import { resolveMealImage, getCachedMealImage, SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';

interface ChooseMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayInfo;
  mealType: MealType;
  currentMeal?: Meal;
  recipes?: Recipe[];
  onSelectMeal: (mealData: {
    title: string;
    image_url: string;
    recipe_id?: string;
    servings?: number;
    calories_per_serving?: number;
  }) => void;
  onRemoveMeal?: () => void;
}

export const ChooseMealModal: React.FC<ChooseMealModalProps> = ({
  isOpen,
  onClose,
  day,
  mealType,
  currentMeal,
  recipes = [],
  onSelectMeal,
  onRemoveMeal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customImage, setCustomImage] = useState('');
  const [customCalories, setCustomCalories] = useState<string>('');
  const [detectedNutrition, setDetectedNutrition] = useState<NutritionItem | null>(null);
  const [nutritionCandidates, setNutritionCandidates] = useState<NutritionItem[]>([]);
  const [isSearchingNutrition, setIsSearchingNutrition] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [servings, setServings] = useState<number>(normalizeServingSize(currentMeal?.servings));
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setServings(normalizeServingSize(currentMeal?.servings));
  }, [currentMeal, isOpen]);

  // Real-time nutrition lookup when user types custom meal name
  useEffect(() => {
    const trimmed = customTitle.trim();
    if (!trimmed || trimmed.length < 2) {
      setDetectedNutrition(null);
      setNutritionCandidates([]);
      setIsSearchingNutrition(false);
      return;
    }

    // 1. Instant local check (database + regional aliases + cache)
    const local = lookupDishNutrition(trimmed);
    const candidates = findNutritionCandidates(trimmed, 3);
    setNutritionCandidates(candidates);

    if (local) {
      setDetectedNutrition(local);
      setCustomCalories(String(local.caloriesPerServing));
      setIsSearchingNutrition(false);
      return;
    } else {
      setDetectedNutrition(null);
    }

    // 2. Debounced asynchronous search (Open Food Facts / cached)
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearchingNutrition(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const asyncRes = await resolveMealNutritionAsync(trimmed);
        if (asyncRes) {
          setDetectedNutrition(asyncRes);
          setCustomCalories(String(asyncRes.caloriesPerServing));
        }
      } finally {
        setIsSearchingNutrition(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [customTitle]);

  // Combine DB recipes and preset catalog dishes
  const allDishes = useMemo(() => {
    const list: AvailableDish[] = [];
    const seenNames = new Set<string>();

    // 1. First add saved recipes from db
    recipes.forEach((r) => {
      seenNames.add(r.title.toLowerCase());
      list.push({
        id: `recipe_${r.id}`,
        name: r.title,
        category: r.category,
        prepTime: r.prep_time,
        image: r.image_url,
        recipeId: r.id,
      });
    });

    // 2. Add catalog items as single source of truth
    MEAL_CATALOG.forEach((d) => {
      if (!seenNames.has(d.name.toLowerCase())) {
        seenNames.add(d.name.toLowerCase());
        list.push({
          id: d.id,
          name: d.name,
          category: d.category,
          prepTime: d.preparationTime,
          image: d.image,
          recipeId: d.recipeId,
        });
      }
    });

    return list;
  }, [recipes]);

  // Categories
  const categories = useMemo(() => {
    const cats = new Set<string>(['All']);
    allDishes.forEach((d) => {
      if (d.category) cats.add(d.category);
    });
    return Array.from(cats);
  }, [allDishes]);

  // Filtered dishes
  const filteredDishes = useMemo(() => {
    return allDishes.filter((dish) => {
      const matchesSearch =
        dish.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dish.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'All' ||
        dish.category.toLowerCase() === selectedCategory.toLowerCase();

      return matchesSearch && matchesCat;
    });
  }, [allDishes, searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customTitle.trim();
    if (!trimmed || isSubmitting) return;

    // Parse user manual calories or auto-detected calories
    const parsedUserCal = customCalories.trim() ? parseInt(customCalories.trim(), 10) : undefined;
    const resolvedCal =
      typeof parsedUserCal === 'number' && !isNaN(parsedUserCal) && parsedUserCal > 0
        ? parsedUserCal
        : detectedNutrition?.caloriesPerServing;

    // Persist verified or manual calories into cache
    if (resolvedCal) {
      setCachedDishNutrition(trimmed, {
        name: detectedNutrition?.name || trimmed,
        caloriesPerServing: resolvedCal,
        servingDescription: detectedNutrition?.servingDescription || '1 standard serving',
        verified: true,
        source: detectedNutrition?.source || 'Manual User Entry',
      });
    }

    // 1. If user provided their own image URL explicitly, use it
    if (customImage.trim()) {
      onSelectMeal({
        title: trimmed,
        image_url: customImage.trim(),
        servings,
        calories_per_serving: resolvedCal,
      });
      return;
    }

    // 2. Check cache first
    const cached = getCachedMealImage(trimmed);
    if (cached && cached !== SAFE_FALLBACK_FOOD_IMAGE) {
      onSelectMeal({
        title: trimmed,
        image_url: cached,
        servings,
        calories_per_serving: resolvedCal,
      });
      return;
    }

    // 3. Dynamically resolve image for this custom meal name
    setIsSubmitting(true);
    try {
      // Fast resolve: search image with timeout race so creation is never blocked
      const resolved = await Promise.race([
        resolveMealImage(trimmed, recipes),
        new Promise<string>((resolve) =>
          setTimeout(() => resolve(SAFE_FALLBACK_FOOD_IMAGE), 2500)
        ),
      ]);

      onSelectMeal({
        title: trimmed,
        image_url: resolved || SAFE_FALLBACK_FOOD_IMAGE,
        servings,
        calories_per_serving: resolvedCal,
      });
    } catch {
      onSelectMeal({
        title: trimmed,
        image_url: SAFE_FALLBACK_FOOD_IMAGE,
        servings,
        calories_per_serving: resolvedCal,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-cream-50 rounded-t-[28px] sm:rounded-2xl border border-borderWarm shadow-float max-h-[88vh] sm:max-h-[85vh] flex flex-col overflow-hidden z-10 animate-sheetUp sm:animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 border-b border-borderWarm bg-white shrink-0">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-terracotta-600 block">
              {day.formattedLong} • {mealType}
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-medium text-ink-900 mt-0.5">
              {currentMeal ? `Change ${mealType}` : `Choose ${mealType}`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center text-ink-400 hover:text-ink-900 rounded-full hover:bg-cream-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Meal Status & Remove Action */}
        {currentMeal && (
          <div className="bg-cream-100/90 px-4 sm:px-5 py-2.5 border-b border-borderWarm flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <img
                src={currentMeal.image_url}
                alt={currentMeal.title}
                className="w-7 h-7 rounded-lg object-cover border border-borderWarm shrink-0"
              />
              <span className="text-xs text-ink-700 truncate">
                Current: <strong className="font-medium text-ink-900">{currentMeal.title}</strong>
              </span>
            </div>

            {onRemoveMeal && (
              <button
                type="button"
                onClick={onRemoveMeal}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium py-1 px-2.5 rounded-lg hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        )}

        {/* Search & Categories */}
        <div className="p-4 pb-2 bg-cream-50 border-b border-borderWarm space-y-3 shrink-0">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search recipes or meals for ${mealType.toLowerCase()}...`}
              className="w-full pl-9 pr-4 py-2 bg-white border border-borderWarm rounded-xl text-xs sm:text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-terracotta-500 shadow-subtle"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const active = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                    active
                      ? 'bg-ink-900 text-white border-ink-900'
                      : 'bg-white text-ink-700 border-borderWarm hover:border-borderWarm-dark hover:bg-cream-100'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Planned Serving Size Stepper */}
          <div className="flex items-center justify-between pt-1 border-t border-borderWarm/70 text-xs">
            <span className="font-serif font-medium text-ink-800">Serving size:</span>
            <div className="flex items-center gap-1.5 bg-white border border-borderWarm rounded-xl px-2 py-0.5 shadow-subtle">
              <button
                type="button"
                onClick={() => setServings((prev) => (prev <= 1 ? 0.5 : prev - 1))}
                disabled={servings <= 0.5}
                aria-label="Decrease serving size"
                className="w-5 h-5 flex items-center justify-center font-bold text-ink-600 hover:text-ink-900 disabled:opacity-25 rounded hover:bg-cream-100 cursor-pointer"
              >
                -
              </button>
              <span className="font-mono text-xs font-semibold text-terracotta-700 min-w-[36px] text-center select-none">
                {servings} {servings === 1 ? 'serving' : 'servings'}
              </span>
              <button
                type="button"
                onClick={() => setServings((prev) => (prev < 1 ? 1 : prev + 1))}
                disabled={servings >= 12}
                aria-label="Increase serving size"
                className="w-5 h-5 flex items-center justify-center font-bold text-ink-600 hover:text-ink-900 disabled:opacity-25 rounded hover:bg-cream-100 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Available Recipes / Dishes List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {filteredDishes.length === 0 ? (
            <div className="text-center py-8 text-ink-500">
              <p className="text-sm">No recipes found matching "{searchQuery}"</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="mt-2 text-xs text-terracotta-600 font-medium hover:underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filteredDishes.map((dish) => {
              const isCurrent = currentMeal?.title === dish.name;
              const dishNut = lookupDishNutrition(dish.name);
              const dishCalories = dishNut ? Math.round(dishNut.caloriesPerServing * servings) : null;

              return (
                <div
                  key={dish.id}
                  onClick={() =>
                    onSelectMeal({
                      title: dish.name,
                      image_url: dish.image,
                      recipe_id: dish.recipeId,
                      servings,
                      calories_per_serving: dishNut?.caloriesPerServing,
                    })
                  }
                  className={`group relative p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 bg-white ${
                    isCurrent
                      ? 'border-terracotta-400 bg-terracotta-50/30 shadow-subtle'
                      : 'border-borderWarm hover:border-terracotta-300 hover:shadow-subtle'
                  }`}
                >
                  <img
                    src={dish.image}
                    alt={dish.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-borderWarm shrink-0 group-hover:scale-105 transition-transform duration-200"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-ink-500 font-medium">
                        {dish.category}
                      </span>
                      {dish.recipeId && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          Saved Recipe
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-sm sm:text-base font-medium text-ink-900 truncate group-hover:text-terracotta-600 transition-colors">
                      {dish.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-ink-500 mt-0.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-terracotta-500 shrink-0" />
                        <span>{dish.prepTime}</span>
                      </div>
                      {dishCalories !== null ? (
                        <>
                          <span className="text-ink-300">•</span>
                          <div className="flex items-center gap-0.5 font-mono text-terracotta-600 font-medium">
                            <Flame className="w-3 h-3 text-terracotta-500 shrink-0" />
                            <span>~{dishCalories} kcal</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-ink-300">•</span>
                          <span className="text-ink-400 italic text-[10px]">Calories unavailable</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isCurrent ? (
                    <div className="w-7 h-7 rounded-full bg-terracotta-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg border border-borderWarm text-xs font-medium text-ink-700 bg-cream-50 group-hover:bg-terracotta-500 group-hover:text-white group-hover:border-terracotta-500 transition-colors shrink-0"
                    >
                      Select
                    </button>
                  )}
                </div>
              );
            })
          )}

          {/* Custom Dish Option */}
          <div className="pt-2 border-t border-borderWarm mt-4">
            {!showCustomForm ? (
              <button
                type="button"
                onClick={() => setShowCustomForm(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-borderWarm hover:border-terracotta-400 bg-white/50 hover:bg-white text-xs font-medium text-ink-600 hover:text-terracotta-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                <span>Add custom dish not in list</span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="p-3.5 bg-white rounded-xl border border-borderWarm space-y-3 shadow-subtle animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-terracotta-500" />
                    <span className="text-xs font-serif font-semibold text-ink-900">Custom Meal</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomForm(false);
                      setCustomTitle('');
                      setCustomImage('');
                      setCustomCalories('');
                      setDetectedNutrition(null);
                      setNutritionCandidates([]);
                    }}
                    className="text-xs text-ink-400 hover:text-ink-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-ink-700 block mb-1">
                    Meal Name (Indian, regional or custom)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. kodi kura, garelu, pappu charu, wada and chatni..."
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-cream-50 border border-borderWarm rounded-lg focus:outline-none focus:border-terracotta-500 text-ink-900 placeholder:text-ink-400 shadow-inner-subtle"
                    autoFocus
                  />
                </div>

                {/* Real-time Nutrition Detection Status & Suggestions */}
                {customTitle.trim().length >= 2 && (
                  <div className="space-y-2">
                    {detectedNutrition ? (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Flame className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-emerald-950 block truncate">
                              {detectedNutrition.name} (~{detectedNutrition.caloriesPerServing} kcal/serving)
                            </span>
                            <span className="text-[10px] text-emerald-700 block truncate">
                              {detectedNutrition.source} • {detectedNutrition.servingDescription}
                            </span>
                          </div>
                        </div>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                          Verified
                        </span>
                      </div>
                    ) : isSearchingNutrition ? (
                      <div className="p-2 rounded-lg bg-cream-100 border border-borderWarm text-xs text-ink-500 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-terracotta-500 shrink-0" />
                        <span className="text-[11px]">Searching nutritional database...</span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-cream-100 border border-borderWarm text-[11px] text-ink-600">
                        Reliable nutrition not auto-detected. You can enter calories per serving manually below.
                      </div>
                    )}

                    {/* Did you mean suggestion chips */}
                    {!detectedNutrition && nutritionCandidates.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wider text-ink-500 font-medium block">
                          Did you mean?
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                          {nutritionCandidates.map((cand) => (
                            <button
                              key={cand.name}
                              type="button"
                              onClick={() => {
                                setCustomTitle(cand.name);
                                setDetectedNutrition(cand);
                                setCustomCalories(String(cand.caloriesPerServing));
                              }}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-cream-100 hover:bg-terracotta-50 hover:text-terracotta-700 hover:border-terracotta-300 border border-borderWarm transition-all text-ink-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Flame className="w-3 h-3 text-terracotta-500 shrink-0" />
                              <span className="font-medium">{cand.name}</span>
                              <span className="font-mono text-terracotta-600 text-[10px]">({cand.caloriesPerServing} kcal)</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Calories per Serving Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-ink-700">
                      Calories per serving (kcal)
                    </label>
                    <span className="text-[10px] text-ink-400">
                      {detectedNutrition ? 'Auto-filled (editable)' : 'Optional manual entry'}
                    </span>
                  </div>
                  <div className="relative">
                    <Flame className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-terracotta-500" />
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      placeholder={detectedNutrition ? String(detectedNutrition.caloriesPerServing) : "e.g. 340"}
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-cream-50 border border-borderWarm rounded-lg focus:outline-none focus:border-terracotta-500 font-mono text-ink-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-ink-700 block mb-1">
                    Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="Leave blank to auto-match high-res food photo"
                    value={customImage}
                    onChange={(e) => setCustomImage(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-cream-50 border border-borderWarm rounded-lg focus:outline-none focus:border-terracotta-500 text-ink-700 placeholder:text-ink-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-terracotta-500 hover:bg-terracotta-600 disabled:opacity-75 text-white rounded-lg text-xs font-medium shadow-subtle transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Matching image & nutrition...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Set as {mealType}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
