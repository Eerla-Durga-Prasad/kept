import { describe, it, expect } from 'vitest';
import { Meal, Recipe } from '../sync/types';
import {
  calculateMealCalories,
  calculateCategoryCalories,
  calculateDailyCalories,
  lookupDishNutrition,
  normalizeServingSize,
} from '../lib/calorieCalculator';

describe('Kept Meal Planner Calorie Tracking Feature Tests', () => {
  const sampleRecipes: Recipe[] = [
    {
      id: 'rec_custom_dosa',
      household_id: 'h1',
      title: 'Family Crispy Dosa',
      prep_time: '20 mins',
      serves: 'Serves 4',
      difficulty: 'Easy',
      description: 'Grandma recipe',
      image_url: 'img_dosa',
      category: 'Breakfast',
      ingredients: [],
      instructions: [],
      created_at: '2026-09-22T08:00:00Z',
      calories_per_serving: 350,
    },
    {
      id: 'rec_veg_biryani',
      household_id: 'h1',
      title: 'Hyderabadi Dum Biryani',
      prep_time: '45 mins',
      serves: 'Serves 6',
      difficulty: 'Medium',
      description: 'Royal biryani',
      image_url: 'img_biryani',
      category: 'Rice Dishes',
      ingredients: [],
      instructions: [],
      created_at: '2026-09-22T08:00:00Z',
    },
  ];

  // -------------------------------------------------------------------------
  // 1. Calories for Every Meal & Verified Data
  // -------------------------------------------------------------------------
  describe('1. Individual Meal Calorie Calculations & Verified Nutrition', () => {
    it('calculates calories for single standard meals using verified nutritional database', () => {
      const meal: Meal = {
        id: 'm1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Crispy Masala Dosa',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const result = calculateMealCalories(meal);
      expect(result.calories).toBe(340);
      expect(result.isEstimate).toBe(true);
      expect(result.servingSize).toBe(1);
      expect(result.baseCalories).toBe(340);
      expect(result.source).toBe('verified_catalog');
    });

    it('uses recipe nutritional data when recipe_id is provided with explicit calories_per_serving', () => {
      const meal: Meal = {
        id: 'm2',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Family Crispy Dosa',
        recipe_id: 'rec_custom_dosa',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const result = calculateMealCalories(meal, sampleRecipes);
      expect(result.calories).toBe(350);
      expect(result.baseCalories).toBe(350);
      expect(result.source).toBe('recipe');
    });

    it('looks up verified nutrition data directly from the catalog', () => {
      const dosa = lookupDishNutrition('Crispy Masala Dosa');
      expect(dosa).toBeDefined();
      expect(dosa?.caloriesPerServing).toBe(340);
      expect(dosa?.verified).toBe(true);
    });

    it('correctly recalculates calories when serving size changes (0.5x, 1x, 2x, 3x)', () => {
      const baseMeal: Meal = {
        id: 'm3',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Tue',
        meal_type: 'Breakfast',
        title: 'Steamed Idli with Sambar & Chutney',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      // 1 serving = 280 kcal
      const result1 = calculateMealCalories({ ...baseMeal, servings: 1 });
      expect(result1.calories).toBe(280);

      // 2 servings = 560 kcal
      const result2 = calculateMealCalories({ ...baseMeal, servings: 2 });
      expect(result2.calories).toBe(560);

      // 0.5 servings = 140 kcal
      const resultHalf = calculateMealCalories({ ...baseMeal, servings: 0.5 });
      expect(resultHalf.calories).toBe(140);

      // 3 servings = 840 kcal
      const result3 = calculateMealCalories({ ...baseMeal, servings: 3 });
      expect(result3.calories).toBe(840);
    });

    it('displays "Calories unavailable" and returns null for unknown meals without reliable data', () => {
      const unknownMeal: Meal = {
        id: 'm4',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Wed',
        meal_type: 'Lunch',
        title: 'Extraterrestrial Space Stew',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const result = calculateMealCalories(unknownMeal);
      expect(result.calories).toBeNull();
      expect(result.source).toBe('unavailable');
      expect(result.details).toBe('Calories unavailable');
    });
  });

  // -------------------------------------------------------------------------
  // 2. Multi-Item Meals & No Double-Counting
  // -------------------------------------------------------------------------
  describe('2. Multi-Item Dishes & Double-Counting Prevention', () => {
    it('does NOT double count existing composite dishes like "Idli & Chutney" or "Roti & Curry"', () => {
      const compositeMeal: Meal = {
        id: 'm5',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Wed',
        meal_type: 'Breakfast',
        title: 'Idli & Chutney',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const result = calculateMealCalories(compositeMeal);
      // "Idli & Chutney" is a single composite dish with verified 280 kcal
      expect(result.calories).toBe(280);
      expect(result.source).toBe('verified_catalog');
    });

    it('calculates combined calories for combination meals with distinct recognized items', () => {
      // "Roti" (100 kcal) + "Paneer Butter Masala" (410 kcal) = 510 kcal
      const multiMeal: Meal = {
        id: 'm6',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Thu',
        meal_type: 'Dinner',
        title: 'Roti and Paneer Butter Masala',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const result = calculateMealCalories(multiMeal);
      expect(result.calories).toBe(510);
      expect(result.source).toBe('multi_item');
      expect(result.subItems).toHaveLength(2);
      expect(result.subItems?.[0].calories).toBe(100);
      expect(result.subItems?.[1].calories).toBe(410);
    });

    it('marks combined meal as unavailable if any composite sub-item has unavailable calories', () => {
      const mixedMeal: Meal = {
        id: 'm7',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Thu',
        meal_type: 'Dinner',
        title: 'Roti and Mystery Alien Dish',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const result = calculateMealCalories(mixedMeal);
      expect(result.calories).toBeNull();
      expect(result.source).toBe('unavailable');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Category Totals: Breakfast, Lunch & Dinner
  // -------------------------------------------------------------------------
  describe('3. Breakfast, Lunch & Dinner Category Totals', () => {
    it('calculates the exact separate category totals for Breakfast, Lunch, and Dinner', () => {
      const breakfastMeal: Meal = {
        id: 'b1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Poha', // 250 kcal
        servings: 1,
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const lunchMeal: Meal = {
        id: 'l1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Lunch',
        title: 'Lemon Rice', // 320 kcal
        servings: 1,
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const dinnerMeal: Meal = {
        id: 'd1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Dinner',
        title: 'Veg Biryani', // 420 kcal
        servings: 2, // 420 * 2 = 840 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const bTotal = calculateCategoryCalories([breakfastMeal]);
      const lTotal = calculateCategoryCalories([lunchMeal]);
      const dTotal = calculateCategoryCalories([dinnerMeal]);

      expect(bTotal.totalCalories).toBe(250);
      expect(bTotal.formattedText).toBe('250 kcal');
      expect(bTotal.isComplete).toBe(true);

      expect(lTotal.totalCalories).toBe(320);
      expect(lTotal.formattedText).toBe('320 kcal');
      expect(lTotal.isComplete).toBe(true);

      expect(dTotal.totalCalories).toBe(840);
      expect(dTotal.formattedText).toBe('840 kcal');
      expect(dTotal.isComplete).toBe(true);
    });

    it('returns empty placeholder "—" when a category has no meals planned', () => {
      const emptyCategory = calculateCategoryCalories([]);
      expect(emptyCategory.totalCalories).toBe(0);
      expect(emptyCategory.mealCount).toBe(0);
      expect(emptyCategory.formattedText).toBe('—');
    });

    it('indicates unavailable calories in category total if a planned meal has no nutrition data', () => {
      const unknownMeal: Meal = {
        id: 'u1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Mysterious Pastry 999',
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const bTotal = calculateCategoryCalories([unknownMeal]);
      expect(bTotal.isComplete).toBe(false);
      expect(bTotal.hasUnavailable).toBe(true);
      expect(bTotal.formattedText).toBe('Calories unavailable');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Daily Total Calories & Incomplete Total Notification
  // -------------------------------------------------------------------------
  describe('4. Daily Total Calories & Incomplete Total Integrity', () => {
    it('calculates Daily Total as Breakfast Total + Lunch Total + Dinner Total accurately', () => {
      const breakfast: Meal = {
        id: 'b1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Oats & Fruits', // 290 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };
      const lunch: Meal = {
        id: 'l1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Lunch',
        title: 'Curd Rice', // 240 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };
      const dinner: Meal = {
        id: 'd1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Dinner',
        title: 'Paneer Butter Masala', // 410 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      // 290 + 240 + 410 = 940 kcal
      const daily = calculateDailyCalories([breakfast], [lunch], [dinner]);
      expect(daily.totalCalories).toBe(940);
      expect(daily.formattedText).toBe('940 kcal');
      expect(daily.isComplete).toBe(true);
      expect(daily.hasUnavailable).toBe(false);
    });

    it('clearly indicates that Daily Total is incomplete when ANY meal has unavailable calorie data instead of treating it as zero', () => {
      const breakfast: Meal = {
        id: 'b1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Oats & Fruits', // 290 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };
      const lunchWithNoNutrition: Meal = {
        id: 'l_unknown',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Lunch',
        title: 'Experimental Food 123', // unavailable
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };
      const dinner: Meal = {
        id: 'd1',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Dinner',
        title: 'Dal Rice', // 360 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const daily = calculateDailyCalories([breakfast], [lunchWithNoNutrition], [dinner]);
      // 290 + 360 = 650 kcal known, but total is marked incomplete
      expect(daily.totalCalories).toBe(650);
      expect(daily.isComplete).toBe(false);
      expect(daily.hasUnavailable).toBe(true);
      expect(daily.unavailableCount).toBe(1);
      expect(daily.formattedText).toContain('650+ kcal (Incomplete)');
    });

    it('reports "No meals planned" when all categories for the day are empty', () => {
      const daily = calculateDailyCalories([], [], []);
      expect(daily.totalCalories).toBe(0);
      expect(daily.totalMealCount).toBe(0);
      expect(daily.formattedText).toBe('No meals planned');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Serving Size Normalization & Extreme Bounds Safety
  // -------------------------------------------------------------------------
  describe('5. Serving Size Normalization & Bounds', () => {
    it('normalizes undefined, null, negative, or zero servings to 1', () => {
      expect(normalizeServingSize(undefined)).toBe(1);
      expect(normalizeServingSize(null)).toBe(1);
      expect(normalizeServingSize(0)).toBe(1);
      expect(normalizeServingSize(-3)).toBe(1);
      expect(normalizeServingSize(NaN)).toBe(1);
    });

    it('rounds fractional servings cleanly and caps excessive values', () => {
      expect(normalizeServingSize(1.5)).toBe(1.5);
      expect(normalizeServingSize(2.3)).toBe(2.5);
      expect(normalizeServingSize(100)).toBe(24);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Independent Weekly Date Isolation & Navigation Safety
  // -------------------------------------------------------------------------
  describe('6. Independent Weekly Date Isolation', () => {
    it('ensures changing Monday breakfast serving size does NOT affect Tuesday breakfast calories or totals', () => {
      const monBreakfast: Meal = {
        id: 'm_mon',
        household_id: 'h1',
        date: '2026-09-22',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Crispy Masala Dosa',
        servings: 1, // 340 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      const tueBreakfast: Meal = {
        id: 'm_tue',
        household_id: 'h1',
        date: '2026-09-23',
        week_start: '2026-09-22',
        day_of_week: 'Tue',
        meal_type: 'Breakfast',
        title: 'Crispy Masala Dosa',
        servings: 1, // 340 kcal
        image_url: 'img',
        created_at: '2026-09-22T08:00:00Z',
      };

      // Monday serving changed to 2
      const updatedMonBreakfast = { ...monBreakfast, servings: 2 };

      const monCal = calculateMealCalories(updatedMonBreakfast);
      const tueCal = calculateMealCalories(tueBreakfast);

      expect(monCal.calories).toBe(680);
      expect(tueCal.calories).toBe(340);
    });
  });
});
