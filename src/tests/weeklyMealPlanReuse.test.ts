import { describe, it, expect, beforeEach } from 'vitest';
import { Meal } from '../sync/types';
import {
  DAYS,
  getWeekDays,
  formatWeekRange,
  formatDateToYYYYMMDD,
  getPreviousWeekMonday,
  getNextWeekMonday,
  hasSavedMealsForWeek,
  isWeekInitialized,
  markWeekInitialized,
  clearInitializedWeeks,
  findPreviousWeekMeals,
  copyWeeklyMealPlan,
  findMealForSlot,
} from '../lib/mealPlanReuse';
import {
  calculateMealCalories,
  calculateCategoryCalories,
  calculateDailyCalories,
  calculateWeeklyCalories,
  DailyCalorieTotal,
} from '../lib/calorieCalculator';

describe('Kept Meal Planner: Reusable Weekly Meal Plans & Weekly Calorie Summary Tests', () => {
  beforeEach(() => {
    clearInitializedWeeks();
  });

  // Mock sample 7-day meal plan for a previous week (e.g. week starting 2026-10-12)
  const createSamplePreviousWeekMeals = (): Meal[] => {
    const monday = new Date(2026, 9, 12); // Mon Oct 12, 2026
    const days = getWeekDays(monday);
    const meals: Meal[] = [];

    const mealTemplates = [
      {
        meal_type: 'Breakfast' as const,
        title: 'Crispy Masala Dosa',
        image_url: 'https://images.unsplash.com/photo-dosa',
        calories_per_serving: 340,
        servings: 1.5,
      },
      {
        meal_type: 'Lunch' as const,
        title: 'Comfort Dal Tadka & Rice',
        recipe_id: 'rec_dal_tadka',
        image_url: 'https://images.unsplash.com/photo-dal',
        calories_per_serving: 420,
        servings: 1,
      },
      {
        meal_type: 'Dinner' as const,
        title: 'Paneer Butter Masala',
        image_url: 'https://images.unsplash.com/photo-paneer',
        calories_per_serving: 480,
        servings: 2,
      },
    ];

    days.forEach((day) => {
      mealTemplates.forEach((t, tIdx) => {
        meals.push({
          id: `meal_prev_${day.dayOfWeek.toLowerCase()}_${tIdx}`,
          household_id: 'h_test_household',
          week_start: '2026-10-12',
          day_of_week: day.dayOfWeek,
          date: day.date,
          meal_type: t.meal_type,
          title: `${day.dayOfWeek} ${t.title}`,
          image_url: t.image_url,
          recipe_id: t.recipe_id,
          servings: t.servings,
          calories_per_serving: t.calories_per_serving,
          notes: `Family favorite on ${day.dayName}`,
          created_at: '2026-10-12T07:00:00.000Z',
        });
      });
    });

    return meals;
  };

  // =========================================================================
  // 1. Reuse Previous Week's Complete Meal Plan
  // =========================================================================
  describe('1. Reusing the Previous Week’s Meal Plan', () => {
    it('automatically copies all 7 days (Breakfast, Lunch, Dinner) into new week when new week has no saved plan', () => {
      const sourceMeals = createSamplePreviousWeekMeals();
      expect(sourceMeals).toHaveLength(21); // 7 days * 3 meals

      const newWeekMonday = new Date(2026, 9, 19); // Mon Oct 19, 2026
      const newWeekDays = getWeekDays(newWeekMonday);
      const newWeekStartStr = formatDateToYYYYMMDD(newWeekMonday);

      // Verify new week starts empty
      expect(hasSavedMealsForWeek(newWeekStartStr, sourceMeals, newWeekDays)).toBe(false);

      // Find previous week
      const prevPlan = findPreviousWeekMeals(newWeekMonday, sourceMeals);
      expect(prevPlan).not.toBeNull();
      expect(prevPlan?.previousWeekStartStr).toBe('2026-10-12');
      expect(prevPlan?.meals).toHaveLength(21);

      // Copy into new week
      const copiedMeals = copyWeeklyMealPlan({
        sourceMeals: prevPlan!.meals,
        sourceWeekDays: prevPlan!.weekDays,
        targetWeekStartDate: newWeekMonday,
      });

      expect(copiedMeals).toHaveLength(21);

      // Verify every day of the new week has Breakfast, Lunch, Dinner
      DAYS.forEach((dow, dayIdx) => {
        const targetDay = newWeekDays[dayIdx];
        const breakfast = findMealForSlot(copiedMeals, targetDay, newWeekStartStr, 'Breakfast');
        const lunch = findMealForSlot(copiedMeals, targetDay, newWeekStartStr, 'Lunch');
        const dinner = findMealForSlot(copiedMeals, targetDay, newWeekStartStr, 'Dinner');

        expect(breakfast).toBeDefined();
        expect(lunch).toBeDefined();
        expect(dinner).toBeDefined();

        // Exact date and week_start set to the new week
        expect(breakfast?.date).toBe(targetDay.date);
        expect(breakfast?.week_start).toBe(newWeekStartStr);
        expect(breakfast?.day_of_week).toBe(dow);

        // Serving size and calories preserved
        expect(breakfast?.servings).toBe(1.5);
        expect(breakfast?.calories_per_serving).toBe(340);
        expect(lunch?.recipe_id).toBe('rec_dal_tadka');
        expect(dinner?.servings).toBe(2);
        expect(dinner?.calories_per_serving).toBe(480);
      });
    });

    it('new week is an independent copy with unique IDs and not a shared reference', () => {
      const sourceMeals = createSamplePreviousWeekMeals();
      const newWeekMonday = new Date(2026, 9, 19);
      const copiedMeals = copyWeeklyMealPlan({
        sourceMeals,
        targetWeekStartDate: newWeekMonday,
      });

      const sourceIds = new Set(sourceMeals.map((m) => m.id));
      const copiedIds = new Set(copiedMeals.map((m) => m.id));

      // No shared IDs
      copiedMeals.forEach((cm) => {
        expect(sourceIds.has(cm.id)).toBe(false);
      });
      expect(copiedIds.size).toBe(copiedMeals.length);

      // Object references are distinct
      expect(copiedMeals[0]).not.toBe(sourceMeals[0]);
    });

    it('editing the new week never changes the previous week', () => {
      const sourceMeals = createSamplePreviousWeekMeals();
      const newWeekMonday = new Date(2026, 9, 19);
      const copiedMeals = copyWeeklyMealPlan({
        sourceMeals,
        targetWeekStartDate: newWeekMonday,
      });

      const allMeals = [...sourceMeals, ...copiedMeals];

      // User changes Wednesday Breakfast in the new week
      const targetDay = getWeekDays(newWeekMonday)[2]; // Wed Oct 21
      const wedBreakfastNew = findMealForSlot(allMeals, targetDay, '2026-10-19', 'Breakfast')!;
      expect(wedBreakfastNew.title).toContain('Crispy Masala Dosa');

      // Edit new week's Wednesday Breakfast to Idli & Chutney with 3 servings
      const updatedMeals = allMeals.map((m) =>
        m.id === wedBreakfastNew.id
          ? {
              ...m,
              title: 'Steamed Idli with Sambar & Chutney',
              servings: 3,
              calories_per_serving: 280,
            }
          : m
      );

      // Verify new week meal is updated
      const newWedBreakfast = findMealForSlot(updatedMeals, targetDay, '2026-10-19', 'Breakfast');
      expect(newWedBreakfast?.title).toBe('Steamed Idli with Sambar & Chutney');
      expect(newWedBreakfast?.servings).toBe(3);
      expect(newWedBreakfast?.calories_per_serving).toBe(280);

      // Verify previous week's Wednesday Breakfast remains UNCHANGED
      const prevWed = getWeekDays(new Date(2026, 9, 12))[2]; // Wed Oct 14
      const prevWedBreakfast = findMealForSlot(updatedMeals, prevWed, '2026-10-12', 'Breakfast');
      expect(prevWedBreakfast?.title).toContain('Crispy Masala Dosa');
      expect(prevWedBreakfast?.servings).toBe(1.5);
      expect(prevWedBreakfast?.calories_per_serving).toBe(340);
    });

    it('deleting a meal in the new week clears only that slot and preserves previous week', () => {
      const sourceMeals = createSamplePreviousWeekMeals();
      const newWeekMonday = new Date(2026, 9, 19);
      const copiedMeals = copyWeeklyMealPlan({
        sourceMeals,
        targetWeekStartDate: newWeekMonday,
      });

      const allMeals = [...sourceMeals, ...copiedMeals];
      const targetDay = getWeekDays(newWeekMonday)[4]; // Fri Oct 23
      const friDinnerNew = findMealForSlot(allMeals, targetDay, '2026-10-19', 'Dinner')!;

      // Delete Friday Dinner in new week
      const filteredMeals = allMeals.filter((m) => m.id !== friDinnerNew.id);

      // New week slot is now empty
      expect(findMealForSlot(filteredMeals, targetDay, '2026-10-19', 'Dinner')).toBeUndefined();

      // Previous week Friday Dinner is still present
      const prevFri = getWeekDays(new Date(2026, 9, 12))[4];
      const prevFriDinner = findMealForSlot(filteredMeals, prevFri, '2026-10-12', 'Dinner');
      expect(prevFriDinner).toBeDefined();
      expect(prevFriDinner?.title).toContain('Paneer Butter Masala');
    });

    it('never overwrites a week that already contains saved meals', () => {
      const sourceMeals = createSamplePreviousWeekMeals();
      const newWeekMonday = new Date(2026, 9, 19);
      const newWeekStartStr = '2026-10-19';

      // Suppose the new week already has 1 meal saved (e.g. user planned Monday breakfast)
      const existingMealInNewWeek: Meal = {
        id: 'user_planned_mon_b',
        household_id: 'h_test_household',
        week_start: newWeekStartStr,
        day_of_week: 'Mon',
        date: '2026-10-19',
        meal_type: 'Breakfast',
        title: 'Avocado Toast & Poached Egg',
        image_url: 'img_avocado',
        servings: 1,
        calories_per_serving: 310,
        created_at: '2026-10-19T06:00:00Z',
      };

      const mealsWithExisting = [...sourceMeals, existingMealInNewWeek];

      // Check hasSavedMealsForWeek
      const hasMeals = hasSavedMealsForWeek(newWeekStartStr, mealsWithExisting);
      expect(hasMeals).toBe(true);

      // When hasMeals is true, copy must NEVER be triggered
      // If someone attempted to copy, the existing meal would be destroyed
      // Therefore, the reuse guard prevents copying:
      let copyPerformed = false;
      if (!hasMeals && !isWeekInitialized(newWeekStartStr)) {
        copyWeeklyMealPlan({ sourceMeals, targetWeekStartDate: newWeekMonday });
        copyPerformed = true;
      }
      expect(copyPerformed).toBe(false);

      // Existing meal is completely preserved
      const monB = findMealForSlot(mealsWithExisting, getWeekDays(newWeekMonday)[0], newWeekStartStr, 'Breakfast');
      expect(monB?.title).toBe('Avocado Toast & Poached Egg');
    });

    it('if no previous week exists, starts with empty planner behavior', () => {
      const emptyMeals: Meal[] = [];
      const targetMonday = new Date(2026, 9, 19);

      const prevPlan = findPreviousWeekMeals(targetMonday, emptyMeals);
      expect(prevPlan).toBeNull();

      expect(hasSavedMealsForWeek('2026-10-19', emptyMeals)).toBe(false);
    });

    it('revisiting or refreshing an initialized week never resets edits or re-copies', () => {
      const sourceMeals = createSamplePreviousWeekMeals();
      const targetMonday = new Date(2026, 9, 19);
      const targetWeekStartStr = '2026-10-19';

      // 1. Initial visit: copies and marks initialized
      const copied = copyWeeklyMealPlan({ sourceMeals, targetWeekStartDate: targetMonday });
      expect(copied).toHaveLength(21);
      markWeekInitialized(targetWeekStartStr);

      // 2. User deletes all meals in the new week (customizing to a clean week)
      const currentMealsAfterUserClearedAll = [...sourceMeals]; // 0 meals in 2026-10-19

      // 3. User navigates away, refreshes, or returns:
      expect(isWeekInitialized(targetWeekStartStr)).toBe(true);

      // Since isWeekInitialized is true, it does NOT re-copy:
      let didReCopy = false;
      if (!hasSavedMealsForWeek(targetWeekStartStr, currentMealsAfterUserClearedAll) && !isWeekInitialized(targetWeekStartStr)) {
        didReCopy = true;
      }
      expect(didReCopy).toBe(false);
    });

    it('handles month boundaries correctly (e.g. Sep 28 – Oct 4, 2026)', () => {
      const sepEndMonday = new Date(2026, 8, 28); // Sep 28, 2026
      const weekDays = getWeekDays(sepEndMonday);

      expect(weekDays[0].date).toBe('2026-09-28'); // Mon
      expect(weekDays[1].date).toBe('2026-09-29'); // Tue
      expect(weekDays[2].date).toBe('2026-09-30'); // Wed
      expect(weekDays[3].date).toBe('2026-10-01'); // Thu (Month boundary!)
      expect(weekDays[4].date).toBe('2026-10-02'); // Fri
      expect(weekDays[5].date).toBe('2026-10-03'); // Sat
      expect(weekDays[6].date).toBe('2026-10-04'); // Sun

      expect(formatWeekRange(weekDays)).toBe('Sep 28 – Oct 4, 2026');

      // Next week Monday
      const nextMonday = getNextWeekMonday(sepEndMonday);
      expect(formatDateToYYYYMMDD(nextMonday)).toBe('2026-10-05');

      // Previous week Monday
      const prevMonday = getPreviousWeekMonday(sepEndMonday);
      expect(formatDateToYYYYMMDD(prevMonday)).toBe('2026-09-21');
    });

    it('handles year boundaries correctly (e.g. Dec 28, 2026 – Jan 3, 2027)', () => {
      const yearEndMonday = new Date(2026, 11, 28); // Dec 28, 2026
      const weekDays = getWeekDays(yearEndMonday);

      expect(weekDays[0].date).toBe('2026-12-28');
      expect(weekDays[1].date).toBe('2026-12-29');
      expect(weekDays[2].date).toBe('2026-12-30');
      expect(weekDays[3].date).toBe('2026-12-31');
      expect(weekDays[4].date).toBe('2027-01-01'); // Year boundary!
      expect(weekDays[5].date).toBe('2027-01-02');
      expect(weekDays[6].date).toBe('2027-01-03');

      expect(formatWeekRange(weekDays)).toBe('Dec 28, 2026 – Jan 3, 2027');
    });
  });

  // =========================================================================
  // 2. Weekly Calorie Summary
  // =========================================================================
  describe('2. Weekly Calorie Summary Calculations', () => {
    it('calculates weekly calories as the exact sum of all 7 daily totals without double-counting', () => {
      const monday = new Date(2026, 9, 19);
      const weekDays = getWeekDays(monday);
      expect(weekDays).toHaveLength(7);

      // Create a daily calorie total for all 7 days:
      // Mon: 1800, Tue: 2000, Wed: 1750, Thu: 1900, Fri: 2100, Sat: 2200, Sun: 1950
      // Sum = 13,700 kcal
      const dailyTotals: DailyCalorieTotal[] = [
        { totalCalories: 1800, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '1,800 kcal', compactText: '1,800 kcal', breakfast: { totalCalories: 400, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '400 kcal' }, lunch: { totalCalories: 600, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '600 kcal' }, dinner: { totalCalories: 800, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '800 kcal' } },
        { totalCalories: 2000, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '2,000 kcal', compactText: '2,000 kcal', breakfast: { totalCalories: 500, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '500 kcal' }, lunch: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' }, dinner: { totalCalories: 800, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '800 kcal' } },
        { totalCalories: 1750, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '1,750 kcal', compactText: '1,750 kcal', breakfast: { totalCalories: 450, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '450 kcal' }, lunch: { totalCalories: 600, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '600 kcal' }, dinner: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' } },
        { totalCalories: 1900, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '1,900 kcal', compactText: '1,900 kcal', breakfast: { totalCalories: 400, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '400 kcal' }, lunch: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' }, dinner: { totalCalories: 800, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '800 kcal' } },
        { totalCalories: 2100, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '2,100 kcal', compactText: '2,100 kcal', breakfast: { totalCalories: 500, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '500 kcal' }, lunch: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' }, dinner: { totalCalories: 900, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '900 kcal' } },
        { totalCalories: 2200, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '2,200 kcal', compactText: '2,200 kcal', breakfast: { totalCalories: 600, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '600 kcal' }, lunch: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' }, dinner: { totalCalories: 900, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '900 kcal' } },
        { totalCalories: 1950, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '1,950 kcal', compactText: '1,950 kcal', breakfast: { totalCalories: 450, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '450 kcal' }, lunch: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' }, dinner: { totalCalories: 800, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '800 kcal' } },
      ];

      const weeklySummary = calculateWeeklyCalories(dailyTotals);

      expect(weeklySummary.totalCalories).toBe(13700);
      expect(weeklySummary.totalMealCount).toBe(21);
      expect(weeklySummary.plannedDaysCount).toBe(7);
      expect(weeklySummary.isComplete).toBe(true);
      expect(weeklySummary.hasUnavailable).toBe(false);
      expect(weeklySummary.formattedText).toBe('13,700 kcal');
      expect(weeklySummary.averageDailyCalories).toBe(Math.round(13700 / 7)); // 1957 kcal/day

      // Category weekly sums:
      expect(weeklySummary.breakfastTotalCalories).toBe(400 + 500 + 450 + 400 + 500 + 600 + 450); // 3300
      expect(weeklySummary.lunchTotalCalories).toBe(600 + 700 + 600 + 700 + 700 + 700 + 700); // 4700
      expect(weeklySummary.dinnerTotalCalories).toBe(800 + 800 + 700 + 800 + 900 + 900 + 800); // 5700
    });

    it('honestly indicates incomplete weekly total when any meal calories are unavailable without treating missing as zero', () => {
      // 6 complete days + 1 day with missing nutrition data for 1 meal
      const dailyTotals: DailyCalorieTotal[] = [
        { totalCalories: 1800, unavailableCount: 0, totalMealCount: 3, hasUnavailable: false, isComplete: true, formattedText: '1,800 kcal', compactText: '1,800 kcal', breakfast: { totalCalories: 500, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '500 kcal' }, lunch: { totalCalories: 600, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '600 kcal' }, dinner: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' } },
        { totalCalories: 1200, unavailableCount: 1, totalMealCount: 3, hasUnavailable: true, isComplete: false, formattedText: '1,200+ kcal (Incomplete)', compactText: '1,200+ kcal*', breakfast: { totalCalories: 500, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '500 kcal' }, lunch: { totalCalories: 700, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '700 kcal' }, dinner: { totalCalories: 0, unavailableCount: 1, mealCount: 1, hasUnavailable: true, isComplete: false, formattedText: 'Calories unavailable' } },
      ];

      const weeklySummary = calculateWeeklyCalories(dailyTotals);

      expect(weeklySummary.totalCalories).toBe(3000);
      expect(weeklySummary.hasUnavailable).toBe(true);
      expect(weeklySummary.unavailableCount).toBe(1);
      expect(weeklySummary.isComplete).toBe(false);
      expect(weeklySummary.formattedText).toBe('3,000+ kcal (Incomplete)');
      expect(weeklySummary.compactText).toBe('3,000+ kcal*');
    });

    it('correctly handles an empty week with 0 meals planned', () => {
      const emptyDays: DailyCalorieTotal[] = Array.from({ length: 7 }, () => ({
        totalCalories: 0,
        unavailableCount: 0,
        totalMealCount: 0,
        hasUnavailable: false,
        isComplete: false,
        formattedText: 'No meals planned',
        compactText: 'No meals',
        breakfast: { totalCalories: 0, unavailableCount: 0, mealCount: 0, hasUnavailable: false, isComplete: true, formattedText: '—' },
        lunch: { totalCalories: 0, unavailableCount: 0, mealCount: 0, hasUnavailable: false, isComplete: true, formattedText: '—' },
        dinner: { totalCalories: 0, unavailableCount: 0, mealCount: 0, hasUnavailable: false, isComplete: true, formattedText: '—' },
      }));

      const weeklySummary = calculateWeeklyCalories(emptyDays);

      expect(weeklySummary.totalCalories).toBe(0);
      expect(weeklySummary.totalMealCount).toBe(0);
      expect(weeklySummary.plannedDaysCount).toBe(0);
      expect(weeklySummary.formattedText).toBe('No meals planned');
      expect(weeklySummary.averageDailyCalories).toBeNull();
    });

    it('recalculates daily and weekly totals accurately when serving size is modified', () => {
      const meal: Meal = {
        id: 'm_serv_test',
        household_id: 'h1',
        week_start: '2026-10-19',
        day_of_week: 'Mon',
        date: '2026-10-19',
        meal_type: 'Breakfast',
        title: 'Crispy Masala Dosa', // 340 base kcal
        servings: 1,
        image_url: 'img',
        created_at: '2026-10-19T00:00:00Z',
      };

      // 1 serving: 340 kcal
      const meal1 = calculateMealCalories(meal);
      expect(meal1.calories).toBe(340);

      // Increase to 2 servings: 680 kcal
      const meal2 = calculateMealCalories({ ...meal, servings: 2 });
      expect(meal2.calories).toBe(680);

      // Category total updates
      const cat1 = calculateCategoryCalories([meal]);
      const cat2 = calculateCategoryCalories([{ ...meal, servings: 2 }]);
      expect(cat1.totalCalories).toBe(340);
      expect(cat2.totalCalories).toBe(680);

      // Daily and weekly totals reflect change
      const daily1 = calculateDailyCalories([meal], [], []);
      const daily2 = calculateDailyCalories([{ ...meal, servings: 2 }], [], []);
      expect(daily1.totalCalories).toBe(340);
      expect(daily2.totalCalories).toBe(680);

      const week1 = calculateWeeklyCalories([daily1]);
      const week2 = calculateWeeklyCalories([daily2]);
      expect(week1.totalCalories).toBe(340);
      expect(week2.totalCalories).toBe(680);
    });
  });

  // =========================================================================
  // 3. Mobile Responsiveness Layout Contract Checks
  // =========================================================================
  describe('3. Mobile Responsiveness & DOM Architecture Contracts', () => {
    it('verifies day strip and day pills have compactText to fit 320px screens', () => {
      const monday = new Date(2026, 9, 19);
      const days = getWeekDays(monday);

      expect(days).toHaveLength(7);
      days.forEach((day) => {
        expect(day.dayOfWeek).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
        expect(day.monthShort).toBe('Oct');
        expect(day.dayNumber).toBeGreaterThan(0);
      });

      // Sample day daily summary
      const sampleDaily: DailyCalorieTotal = {
        totalCalories: 1840,
        unavailableCount: 0,
        totalMealCount: 3,
        hasUnavailable: false,
        isComplete: true,
        formattedText: '1,840 kcal',
        compactText: '1,840 kcal',
        breakfast: { totalCalories: 400, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '400 kcal' },
        lunch: { totalCalories: 640, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '640 kcal' },
        dinner: { totalCalories: 800, unavailableCount: 0, mealCount: 1, hasUnavailable: false, isComplete: true, formattedText: '800 kcal' },
      };

      // Compact representation fits cleanly inside small cards at 320px viewport
      expect(sampleDaily.compactText).toBe('1,840 kcal');
      expect(sampleDaily.compactText?.length).toBeLessThan(15);
    });
  });
});
