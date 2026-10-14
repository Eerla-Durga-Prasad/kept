import React, { useState, useMemo } from 'react';
import { Meal, DayOfWeek, MealType, Recipe } from '../sync/types';
import { MealCard } from '../components/MealCard';
import { ChooseMealModal, DayInfo } from '../components/ChooseMealModal';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { db } from '../db/database';
import { enqueueOutboxOperation, generateUUID } from '../sync/outbox';
import { syncEngine } from '../sync/syncEngine';
import { getMealDefinition } from '../lib/mealCatalog';
import { getCachedMealImage, resolveMealImage, SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';

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
  }) => Promise<void>;
  onDeleteMeal?: (mealId: string) => Promise<void>;
  onAddMeal?: (meal: Omit<Meal, 'id' | 'created_at'>) => void;
  onSelectRecipeForMeal?: (recipeId: string) => void;
  isMobile?: boolean;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

// Helper to compute 7 days for a given week start date
const getWeekDays = (baseDate: Date): DayInfo[] => {
  return DAYS.map((dayOfWeek, idx) => {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + idx);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const monthShort = d.toLocaleDateString('en-US', { month: 'short' });
    const dayNum = d.getDate();
    return {
      date: dateStr,
      dayOfWeek,
      dayName: DAY_NAMES[idx],
      monthShort,
      dayNumber: dayNum,
      formattedHeader: `${dayOfWeek} — ${monthShort} ${dayNum}`,
      formattedLong: `${monthShort} ${dayNum}, ${DAY_NAMES[idx]}`,
    };
  });
};

// Helper to format week range string cleanly without awkward wraps
const formatWeekRange = (days: DayInfo[]): string => {
  if (days.length === 0) return '';
  const start = days[0];
  const end = days[days.length - 1];
  const startYear = start.date.split('-')[0];
  const endYear = end.date.split('-')[0];

  if (start.monthShort === end.monthShort && startYear === endYear) {
    return `${start.monthShort} ${start.dayNumber} – ${end.dayNumber}, ${startYear}`;
  } else if (startYear === endYear) {
    return `${start.monthShort} ${start.dayNumber} – ${end.monthShort} ${end.dayNumber}, ${startYear}`;
  } else {
    return `${start.monthShort} ${start.dayNumber}, ${startYear} – ${end.monthShort} ${end.dayNumber}, ${endYear}`;
  }
};

// Helper to get Monday of the current calendar week based on user's local date
export const getCurrentWeekMonday = (base: Date = new Date()): Date => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

export const Meals: React.FC<MealsProps> = ({
  meals,
  recipes = [],
  onSaveMeal,
  onDeleteMeal,
  onAddMeal,
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

  // Compute 7 days of the current week
  const weekDays = useMemo(() => getWeekDays(weekStartDate), [weekStartDate]);
  const selectedDay = weekDays[selectedDayIndex] || weekDays[0];

  // ISO string for week start: "YYYY-MM-DD"
  const weekStartStr = useMemo(() => {
    const y = weekStartDate.getFullYear();
    const m = String(weekStartDate.getMonth() + 1).padStart(2, '0');
    const d = String(weekStartDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [weekStartDate]);

  const weekRangeLabel = useMemo(() => formatWeekRange(weekDays), [weekDays]);

  // Navigate to previous week
  const handlePrevWeek = () => {
    setWeekStartDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
  };

  // Navigate to next week
  const handleNextWeek = () => {
    setWeekStartDate((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
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
  const handleSelectMeal = async (selected: { title: string; image_url: string; recipe_id?: string }) => {
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

  // Resolve missing or temporary fallback images asynchronously without blocking render
  React.useEffect(() => {
    const handleResolveMissingImages = () => {
      meals.forEach((m) => {
        const isMealOldFallback = Boolean(
          m.image_url &&
          m.image_url.includes('photo-1546833999-b9f581a1996d') &&
          !m.title.toLowerCase().includes('dal') &&
          !m.title.toLowerCase().includes('tadka')
        );

        if (m.title && (!m.image_url || m.image_url === SAFE_FALLBACK_FOOD_IMAGE || isMealOldFallback)) {
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
                };
                if (onSaveMeal) onSaveMeal(updatePayload);
                else handleSaveMealFallback(updatePayload);
              }
            }).catch(() => {});
          }
        }
      });
    };

    handleResolveMissingImages();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleResolveMissingImages);
      return () => window.removeEventListener('online', handleResolveMissingImages);
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
      } gap-1 bg-white px-2 py-1.5 rounded-2xl border border-borderWarm shadow-subtle w-full max-w-sm mx-auto shrink-0`}
    >
      <button
        type="button"
        onClick={handlePrevWeek}
        aria-label="Previous week"
        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-600 hover:text-ink-900 rounded-xl hover:bg-cream-100 active:scale-95 transition-all cursor-pointer shrink-0"
      >
        <ChevronLeft className="w-5 h-5 stroke-[2]" />
      </button>

      <div
        className={`flex items-center justify-center gap-1.5 flex-1 ${
          isMobile ? '' : 'md:flex-initial'
        } px-2 text-center select-none overflow-hidden min-w-0`}
      >
        <Calendar className="w-4 h-4 text-terracotta-500 shrink-0 hidden xs:inline" />
        <span
          className={`font-serif text-sm ${
            isMobile ? '' : 'md:text-base'
          } font-medium text-ink-900 whitespace-nowrap`}
        >
          {weekRangeLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={handleNextWeek}
        aria-label="Next week"
        className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-ink-600 hover:text-ink-900 rounded-xl hover:bg-cream-100 active:scale-95 transition-all cursor-pointer shrink-0"
      >
        <ChevronRight className="w-5 h-5 stroke-[2]" />
      </button>
    </div>
  );

  // ----------------------------------------------------
  // SUB-LAYOUT: Mobile Layout (Horizontal Day Scroll + Day Meal Stack)
  // ----------------------------------------------------
  const renderMobileLayout = () => (
    <div className="space-y-5 animate-fadeIn">
      {/* Horizontal Scrollable Day Strip */}
      <div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none snap-x snap-mandatory">
          {weekDays.map((day, idx) => {
            const isSelected = selectedDayIndex === idx;
            // Check if day has any meals planned
            const dayMealsCount = MEAL_TYPES.filter((t) => findMealForSlot(day, t)).length;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDayIndex(idx)}
                className={`snap-start shrink-0 min-w-[76px] py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border relative ${
                  isSelected
                    ? 'bg-terracotta-500 text-white border-terracotta-500 shadow-card scale-[1.02]'
                    : 'bg-white text-ink-800 border-borderWarm hover:border-terracotta-300 hover:bg-cream-50'
                }`}
              >
                <span
                  className={`text-[11px] font-semibold tracking-wider uppercase block ${
                    isSelected ? 'text-cream-100' : 'text-ink-500'
                  }`}
                >
                  {day.dayOfWeek}
                </span>
                <span
                  className={`font-serif text-base font-semibold mt-0.5 block ${
                    isSelected ? 'text-white' : 'text-ink-900'
                  }`}
                >
                  {day.monthShort} {day.dayNumber}
                </span>

                {/* Subtle indicator dots for planned meals */}
                {dayMealsCount > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      isSelected ? 'bg-cream-100' : 'bg-terracotta-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Header & Meals List */}
      <div className="space-y-4">
        <div className="pb-1 border-b border-borderWarm-subtle flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-2xl font-medium text-ink-900">
              {selectedDay.formattedLong}
            </h2>
            <p className="font-serif italic text-xs text-ink-500 mt-0.5 font-normal">
              Breakfast, Lunch, and Dinner
            </p>
          </div>
          <span className="text-[11px] text-terracotta-600 font-medium font-mono">
            {selectedDay.dayOfWeek}
          </span>
        </div>

        {/* 3 Meal Cards: Breakfast, Lunch, Dinner */}
        <div className="space-y-3.5">
          {MEAL_TYPES.map((type) => {
            const meal = findMealForSlot(selectedDay, type);
            const selectedMeal = meal ? getMealDefinition(meal, recipes) : undefined;
            const displayTitle = meal?.title || selectedMeal?.name || 'Meal';
            const displayImage = meal?.image_url || selectedMeal?.image || SAFE_FALLBACK_FOOD_IMAGE;
            const displayCategory = selectedMeal?.category || type;
            const displayPrepTime = selectedMeal?.preparationTime;

            return (
              <div key={type} className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="font-serif text-sm font-semibold text-ink-800">
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

                {meal ? (
                  <div
                    onClick={() => handleOpenChooseMeal(selectedDay, type, meal)}
                    className="group bg-white rounded-2xl border border-borderWarm p-3 shadow-subtle hover:border-terracotta-300 transition-all cursor-pointer flex items-center gap-3.5 active:bg-cream-50"
                  >
                    <img
                      src={displayImage}
                      alt={displayTitle}
                      className="w-16 h-16 rounded-xl object-cover border border-borderWarm shrink-0 group-hover:scale-105 transition-transform duration-200"
                    />

                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-terracotta-600 font-semibold block">
                          {displayCategory}
                        </span>
                        {displayPrepTime && (
                          <span className="text-[10px] text-ink-400 font-mono">
                            • {displayPrepTime}
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif text-base font-medium text-ink-900 truncate group-hover:text-terracotta-600 transition-colors">
                        {displayTitle}
                      </h3>
                      <span className="text-xs text-ink-500 mt-0.5 block">
                        Tap to change or remove
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenChooseMeal(selectedDay, type, meal);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-borderWarm text-xs font-medium text-ink-700 bg-cream-50 group-hover:bg-terracotta-500 group-hover:text-white group-hover:border-terracotta-500 transition-colors shrink-0 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenChooseMeal(selectedDay, type)}
                    className="w-full h-16 rounded-2xl border border-dashed border-borderWarm hover:border-terracotta-400 bg-white/60 hover:bg-white flex items-center justify-center gap-2 text-ink-500 hover:text-terracotta-600 transition-all cursor-pointer text-xs font-medium active:scale-[0.99]"
                  >
                    <Plus className="w-4 h-4 stroke-[1.7]" />
                    <span>Add {type}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ----------------------------------------------------
  // SUB-LAYOUT: Desktop Weekly Grid Layout
  // ----------------------------------------------------
  const renderDesktopLayout = () => (
    <div className="overflow-x-auto pb-6 animate-fadeIn">
      <div className="min-w-[850px] space-y-5">
        {/* Column Headers */}
        <div className="grid grid-cols-8 gap-3 items-center">
          <div className="text-xs font-serif italic text-ink-500 font-medium pl-1">
            Meals
          </div>
          {weekDays.map((day) => (
            <div
              key={day.date}
              className="text-center py-2.5 px-1.5 rounded-xl bg-cream-50 border border-borderWarm"
            >
              <span className="font-serif text-sm font-semibold text-ink-900 block">
                {day.dayOfWeek}
              </span>
              <span className="text-[11px] text-ink-500 font-mono">
                {day.monthShort} {day.dayNumber}
              </span>
            </div>
          ))}
        </div>

        {/* Rows for Breakfast, Lunch, Dinner */}
        {MEAL_TYPES.map((type) => (
          <div key={type} className="grid grid-cols-8 gap-3 items-center">
            <div className="font-serif text-sm font-medium text-ink-800 pr-2 pl-1">
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
                  onAddMealClick={() => handleOpenChooseMeal(day, type)}
                  onMealClick={() => handleOpenChooseMeal(day, type, meal)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn">
      {/* Header with Title & Date Navigation */}
      <div
        className={`meal-planner-header flex flex-col ${
          isMobile ? '' : 'md:flex-row md:items-end'
        } justify-between gap-4 pb-5 mb-6 border-b border-borderWarm`}
      >
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
            Meal Planner
          </h1>
          <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1 font-normal">
            Plan better meals. Waste less. Live well.
          </p>
        </div>

        {/* Clean Week selector pill */}
        {renderWeekNav()}
      </div>

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
