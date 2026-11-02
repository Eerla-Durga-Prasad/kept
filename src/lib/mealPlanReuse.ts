// Weekly Meal Plan Reuse & Week Date Management for Kept
// Enables automatic prefilling of new weeks from the previous week's plan with strict data isolation.

import { Meal, DayOfWeek, MealType } from '../sync/types';
import { generateUUID } from '../sync/outbox';

export const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];

export interface DayInfo {
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  dayName: string;
  monthShort: string;
  dayNumber: number;
  formattedHeader: string;
  formattedLong: string;
}

/**
 * Timezone-safe formatting of a Date object to YYYY-MM-DD string using local calendar values.
 */
export const formatDateToYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Timezone-safe parsing of a YYYY-MM-DD string into a local Date object.
 */
export const parseYYYYMMDD = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Returns Monday of the calendar week containing baseDate.
 * Timezone-safe and based on local calendar dates.
 */
export const getCurrentWeekMonday = (base: Date = new Date()): Date => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const day = d.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
};

/**
 * Returns Monday of the week immediately preceding the given Monday.
 */
export const getPreviousWeekMonday = (monday: Date): Date => {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
};

/**
 * Returns Monday of the week immediately following the given Monday.
 */
export const getNextWeekMonday = (monday: Date): Date => {
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7);
};

/**
 * Computes DayInfo for all 7 days of the week starting at baseMonday.
 */
export const getWeekDays = (baseMonday: Date): DayInfo[] => {
  return DAYS.map((dayOfWeek, idx) => {
    const d = new Date(baseMonday.getFullYear(), baseMonday.getMonth(), baseMonday.getDate() + idx);
    const dateStr = formatDateToYYYYMMDD(d);
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

/**
 * Formats a clean, readable week range label (e.g. "Oct 19 – 25, 2026" or "Sep 29 – Oct 5, 2026").
 */
export const formatWeekRange = (days: DayInfo[]): string => {
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

/**
 * Finds a meal for a specific day and meal type slot.
 * Matches by exact date first, then falls back to week_start + day_of_week for seed data.
 */
export const findMealForSlot = (
  meals: Meal[],
  day: DayInfo,
  weekStartStr: string,
  mealType: MealType
): Meal | undefined => {
  return meals.find((m) => {
    if (m.meal_type !== mealType) return false;
    if (m.date) {
      return m.date === day.date;
    }
    return m.week_start === weekStartStr && m.day_of_week === day.dayOfWeek;
  });
};

// ============================================================================
// Week Initialization & Safe Re-use Tracking
// ============================================================================

const INITIALIZED_WEEKS_STORAGE_KEY = 'kept_initialized_meal_weeks';

// In-memory set for fast lookup and unit testing without DOM/localStorage
const inMemoryInitializedWeeks = new Set<string>();

/**
 * Checks whether a given week has already been initialized in this session or stored persistently.
 */
export const isWeekInitialized = (weekStartStr: string): boolean => {
  if (inMemoryInitializedWeeks.has(weekStartStr)) {
    return true;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(INITIALIZED_WEEKS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.includes(weekStartStr)) {
          inMemoryInitializedWeeks.add(weekStartStr);
          return true;
        }
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
  return false;
};

/**
 * Marks a given week as initialized to prevent repeated copying or resetting user edits.
 */
export const markWeekInitialized = (weekStartStr: string): void => {
  inMemoryInitializedWeeks.add(weekStartStr);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(INITIALIZED_WEEKS_STORAGE_KEY);
      let list: string[] = [];
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) list = parsed;
      }
      if (!list.includes(weekStartStr)) {
        list.push(weekStartStr);
        localStorage.setItem(INITIALIZED_WEEKS_STORAGE_KEY, JSON.stringify(list));
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }
};

/**
 * Resets initialized weeks tracking (useful for tests or app reset).
 */
export const clearInitializedWeeks = (): void => {
  inMemoryInitializedWeeks.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(INITIALIZED_WEEKS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
};

/**
 * Determines whether a week already has any saved meals in the database/state.
 */
export const hasSavedMealsForWeek = (
  weekStartStr: string,
  meals: Meal[],
  weekDays?: DayInfo[]
): boolean => {
  if (!meals || meals.length === 0) return false;

  const days = weekDays || getWeekDays(parseYYYYMMDD(weekStartStr));
  const weekDateSet = new Set(days.map((d) => d.date));

  return meals.some((m) => {
    if (m.date && weekDateSet.has(m.date)) {
      return true;
    }
    return m.week_start === weekStartStr;
  });
};

/**
 * Finds the previous week's meal plan to copy.
 * 1. First looks at the immediate previous week (7 days prior).
 * 2. If the immediate previous week has no saved meals, searches for the most recent prior week with meals.
 * 3. Returns null if no prior week exists with saved meals.
 */
export const findPreviousWeekMeals = (
  targetWeekStartDate: Date,
  allMeals: Meal[]
): { previousWeekStartStr: string; meals: Meal[]; weekDays: DayInfo[] } | null => {
  if (!allMeals || allMeals.length === 0) return null;

  const targetWeekStartStr = formatDateToYYYYMMDD(targetWeekStartDate);

  // 1. Check immediate previous week (target - 7 days)
  const prevMonday = getPreviousWeekMonday(targetWeekStartDate);
  const prevWeekStartStr = formatDateToYYYYMMDD(prevMonday);
  const prevWeekDays = getWeekDays(prevMonday);

  const prevWeekDateSet = new Set(prevWeekDays.map((d) => d.date));
  const immediatePrevMeals = allMeals.filter((m) => {
    if (m.date && prevWeekDateSet.has(m.date)) return true;
    return m.week_start === prevWeekStartStr;
  });

  if (immediatePrevMeals.length > 0) {
    return {
      previousWeekStartStr: prevWeekStartStr,
      meals: immediatePrevMeals,
      weekDays: prevWeekDays,
    };
  }

  // 2. Fall back to the most recent prior week strictly before target week
  // Collect all distinct week_start dates or inferred week starts before target
  const priorWeeksMap = new Map<string, Meal[]>();

  for (const m of allMeals) {
    let weekStart = m.week_start;
    if (!weekStart && m.date) {
      weekStart = formatDateToYYYYMMDD(getCurrentWeekMonday(parseYYYYMMDD(m.date)));
    }
    if (weekStart && weekStart < targetWeekStartStr) {
      if (!priorWeeksMap.has(weekStart)) {
        priorWeeksMap.set(weekStart, []);
      }
      priorWeeksMap.get(weekStart)!.push(m);
    }
  }

  if (priorWeeksMap.size === 0) {
    return null;
  }

  // Find the most recent prior week start
  const sortedPriorWeeks = Array.from(priorWeeksMap.keys()).sort().reverse();
  const mostRecentWeekStart = sortedPriorWeeks[0];
  const mostRecentMeals = priorWeeksMap.get(mostRecentWeekStart) || [];

  if (mostRecentMeals.length === 0) {
    return null;
  }

  const mostRecentMonday = parseYYYYMMDD(mostRecentWeekStart);
  return {
    previousWeekStartStr: mostRecentWeekStart,
    meals: mostRecentMeals,
    weekDays: getWeekDays(mostRecentMonday),
  };
};

/**
 * Copies a complete seven-day meal plan into a target week.
 * - Creates an independent, deep copy with new unique UUIDs.
 * - Preserves Breakfast, Lunch, Dinner, meal names, recipe references, images, serving sizes, calories, notes.
 * - Sets the exact target dates for each day without shared object references.
 * - Does not modify or overwrite the source meals.
 */
export const copyWeeklyMealPlan = (params: {
  sourceMeals: Meal[];
  sourceWeekDays?: DayInfo[];
  targetWeekStartDate: Date;
  householdId?: string;
}): Meal[] => {
  const { sourceMeals, targetWeekStartDate, householdId } = params;
  const targetWeekDays = getWeekDays(targetWeekStartDate);
  const targetWeekStartStr = formatDateToYYYYMMDD(targetWeekStartDate);

  const copiedMeals: Meal[] = [];

  // Iterate over all 7 days of the target week
  targetWeekDays.forEach((targetDay) => {
    MEAL_TYPES.forEach((mealType) => {
      // Find corresponding meal in source meals
      const sourceMeal = sourceMeals.find((m) => {
        if (m.meal_type !== mealType) return false;
        if (m.day_of_week) {
          return m.day_of_week === targetDay.dayOfWeek;
        }
        // In case day_of_week was not stored, infer from source date
        if (m.date && params.sourceWeekDays) {
          const matchDay = params.sourceWeekDays.find((d) => d.date === m.date);
          return matchDay?.dayOfWeek === targetDay.dayOfWeek;
        }
        return false;
      });

      if (sourceMeal) {
        const newMeal: Meal = {
          id: generateUUID(),
          household_id: sourceMeal.household_id || householdId || 'h_default_household_01',
          week_start: targetWeekStartStr,
          day_of_week: targetDay.dayOfWeek,
          date: targetDay.date,
          meal_type: sourceMeal.meal_type,
          title: sourceMeal.title,
          image_url: sourceMeal.image_url,
          recipe_id: sourceMeal.recipe_id,
          servings: sourceMeal.servings !== undefined ? sourceMeal.servings : 1,
          calories_per_serving: sourceMeal.calories_per_serving,
          notes: sourceMeal.notes,
          created_at: new Date().toISOString(),
        };

        if (!newMeal.recipe_id) {
          delete newMeal.recipe_id;
        }
        if (!newMeal.notes) {
          delete newMeal.notes;
        }

        copiedMeals.push(newMeal);
      }
    });
  });

  return copiedMeals;
};
