import { describe, it, expect, beforeEach } from 'vitest';
import { Meal } from '../sync/types';
import {
  calculateMealCalories,
  calculateCategoryCalories,
  calculateDailyCalories,
  lookupDishNutrition,
  findNutritionCandidates,
  resolveMealNutritionAsync,
  getCachedDishNutrition,
  setCachedDishNutrition,
} from '../lib/calorieCalculator';

const mockStorage: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => {
      mockStorage[k] = v;
    },
    removeItem: (k: string) => {
      delete mockStorage[k];
    },
    clear: () => {
      for (const k in mockStorage) {
        delete mockStorage[k];
      }
    },
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
    get length() {
      return Object.keys(mockStorage).length;
    },
  } as Storage;
}

describe('Custom Meal Calorie Detection & Mobile Responsiveness Tests', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  // =========================================================================
  // 1. Telugu & Indian Regional Dish Recognition
  // =========================================================================
  describe('1. Telugu & Indian Regional Dish Nutrition Detection', () => {
    it('detects calories for classic Telugu dishes (Andhra & Telangana)', () => {
      const dishes = [
        { name: 'Kodi Kura', expectedKcal: 440 },
        { name: 'Kodi Vepudu', expectedKcal: 390 },
        { name: 'Chepala Pulusu', expectedKcal: 320 },
        { name: 'Gongura Mamsam', expectedKcal: 530 },
        { name: 'Gongura Pappu', expectedKcal: 240 },
        { name: 'Gutti Vankaya', expectedKcal: 280 },
        { name: 'Pappu Charu', expectedKcal: 140 },
        { name: 'Majjiga Pulusu', expectedKcal: 160 },
        { name: 'Bendakaya Vepudu', expectedKcal: 180 },
        { name: 'Garelu', expectedKcal: 310 },
        { name: 'Bobbatlu', expectedKcal: 280 },
        { name: 'Ariselu', expectedKcal: 290 },
        { name: 'Sunnundalu', expectedKcal: 220 },
        { name: 'Poornam Boorelu', expectedKcal: 270 },
        { name: 'Paramannam', expectedKcal: 290 },
        { name: 'Ragi Sankati', expectedKcal: 280 },
        { name: 'Daddojanam', expectedKcal: 260 },
        { name: 'Pulihora', expectedKcal: 340 },
      ];

      for (const dish of dishes) {
        const nut = lookupDishNutrition(dish.name);
        expect(nut, `Failed to detect nutrition for Telugu dish: ${dish.name}`).toBeDefined();
        expect(nut?.caloriesPerServing).toBe(dish.expectedKcal);
        expect(nut?.verified).toBe(true);
      }
    });

    it('detects calories for North & South Indian staples', () => {
      const staples = [
        { name: 'Butter Chicken', expectedKcal: 490 },
        { name: 'Dal Makhani', expectedKcal: 340 },
        { name: 'Paneer Butter Masala', expectedKcal: 410 },
        { name: 'Palak Paneer', expectedKcal: 340 },
        { name: 'Chole Bhature', expectedKcal: 550 },
        { name: 'Poori Bhaji', expectedKcal: 380 },
        { name: 'Aloo Paratha', expectedKcal: 290 },
      ];

      for (const item of staples) {
        const nut = lookupDishNutrition(item.name);
        expect(nut, `Failed to detect nutrition for staple: ${item.name}`).toBeDefined();
        expect(nut?.caloriesPerServing).toBe(item.expectedKcal);
      }
    });
  });

  // =========================================================================
  // 2. Spelling Variations & Transliteration Normalization
  // =========================================================================
  describe('2. Regional Spelling Variations & Transliterations', () => {
    it('handles phonetic transliteration variations of common dishes', () => {
      // Idli variants
      expect(lookupDishNutrition('idly')?.caloriesPerServing).toBe(160);
      expect(lookupDishNutrition('steamed idli with sambar & chutney')?.caloriesPerServing).toBe(280);

      // Vada / Wada variants
      expect(lookupDishNutrition('wada')?.caloriesPerServing).toBe(310);
      expect(lookupDishNutrition('medu wada')?.caloriesPerServing).toBe(310);
      expect(lookupDishNutrition('vada')?.caloriesPerServing).toBe(310);

      // Dosa / Dosai variants
      expect(lookupDishNutrition('dosai')?.caloriesPerServing).toBe(340);
      expect(lookupDishNutrition('masala dosai')?.caloriesPerServing).toBe(340);

      // Chapati / Chapathi variants
      expect(lookupDishNutrition('chapathi')?.caloriesPerServing).toBe(290);
      expect(lookupDishNutrition('chapati & sabzi')?.caloriesPerServing).toBe(290);

      // Biryani / Biriyani variants
      expect(lookupDishNutrition('hyderabadi biriyani')?.caloriesPerServing).toBe(420);

      // Pesarattu / Pesarettu variants
      expect(lookupDishNutrition('pesarettu')?.caloriesPerServing).toBe(240);
      expect(lookupDishNutrition('pesarattu')?.caloriesPerServing).toBe(240);
      expect(lookupDishNutrition('andhra pesarattu with upma')?.caloriesPerServing).toBe(330);
    });
  });

  // =========================================================================
  // 3. Nutrition Candidate Auto-Suggestions
  // =========================================================================
  describe('3. Nutrition Candidate Auto-Suggestions for Custom Meals', () => {
    it('returns matching candidates for partial queries', () => {
      const candidates = findNutritionCandidates('pappu');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some((c) => c.name.toLowerCase().includes('pappu'))).toBe(true);
      expect(candidates[0].caloriesPerServing).toBeGreaterThan(0);
    });

    it('returns Telugu chicken dishes for query "kodi"', () => {
      const candidates = findNutritionCandidates('kodi');
      expect(candidates.length).toBeGreaterThanOrEqual(1);
      const names = candidates.map((c) => c.name.toLowerCase());
      expect(names.some((n) => n.includes('kodi'))).toBe(true);
    });

    it('returns empty candidates for non-matching nonsense strings', () => {
      const candidates = findNutritionCandidates('xyzqwer123random');
      expect(candidates).toEqual([]);
    });
  });

  // =========================================================================
  // 4. Custom Meal Manual Calorie Entry & Persistence
  // =========================================================================
  describe('4. Custom Meal Manual Calorie Entry & Priority', () => {
    it('uses explicit calories_per_serving on meal when provided by user', () => {
      const customMeal: Meal = {
        id: 'custom_m1',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Dinner',
        title: 'Grandma Homemade Curry',
        image_url: 'custom_curry.jpg',
        servings: 1,
        calories_per_serving: 420,
        created_at: new Date().toISOString(),
      };

      const result = calculateMealCalories(customMeal);
      expect(result.calories).toBe(420);
      expect(result.baseCalories).toBe(420);
      expect(result.source).toBe('manual');
      expect(result.isEstimate).toBe(false);
    });

    it('scales manual calories accurately with serving count changes', () => {
      const customMeal: Meal = {
        id: 'custom_m2',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Lunch',
        title: 'Special Millet Bowl',
        image_url: 'millet.jpg',
        calories_per_serving: 350,
        servings: 2,
        created_at: new Date().toISOString(),
      };

      // 2 servings * 350 = 700 kcal
      const result2 = calculateMealCalories(customMeal);
      expect(result2.calories).toBe(700);

      // 0.5 servings * 350 = 175 kcal
      const resultHalf = calculateMealCalories({ ...customMeal, servings: 0.5 });
      expect(resultHalf.calories).toBe(175);

      // 3 servings * 350 = 1050 kcal
      const result3 = calculateMealCalories({ ...customMeal, servings: 3 });
      expect(result3.calories).toBe(1050);
    });

    it('prioritizes explicit manual calories even if dish title matches catalog', () => {
      const mealWithOverride: Meal = {
        id: 'm_override',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Crispy Masala Dosa', // Database default is 340
        image_url: 'dosa.jpg',
        calories_per_serving: 450, // User explicitly set larger serving at 450 kcal
        servings: 1,
        created_at: new Date().toISOString(),
      };

      const result = calculateMealCalories(mealWithOverride);
      expect(result.calories).toBe(450);
      expect(result.source).toBe('manual');
    });
  });

  // =========================================================================
  // 5. Honest Handling of Missing Nutritional Data
  // =========================================================================
  describe('5. Missing Nutritional Data & Incomplete Daily Totals', () => {
    it('returns calories: null and source: unavailable for unknown dishes without manual calories', () => {
      const unknownMeal: Meal = {
        id: 'm_unk',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Lunch',
        title: 'Unique Galactic Stew 9000',
        image_url: 'fallback.jpg',
        servings: 1,
        created_at: new Date().toISOString(),
      };

      const result = calculateMealCalories(unknownMeal);
      expect(result.calories).toBeNull();
      expect(result.baseCalories).toBeNull();
      expect(result.source).toBe('unavailable');
    });

    it('indicates incomplete category total when a meal has unavailable nutrition', () => {
      const unknownMeal: Meal = {
        id: 'm_unk',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Lunch',
        title: 'Mysterious Dish',
        image_url: 'img',
        created_at: new Date().toISOString(),
      };

      const catTotal = calculateCategoryCalories([unknownMeal]);
      expect(catTotal.totalCalories).toBe(0);
      expect(catTotal.isComplete).toBe(false);
      expect(catTotal.hasUnavailable).toBe(true);
      expect(catTotal.formattedText).toBe('Calories unavailable');
      expect(['N/A', 'Unavailable']).toContain(catTotal.compactText);
    });

    it('indicates incomplete daily total and avoids treating missing data as zero', () => {
      const breakfastMeal: Meal = {
        id: 'b1',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Breakfast',
        title: 'Idli', // 160 kcal
        image_url: 'idli.jpg',
        created_at: new Date().toISOString(),
      };

      const lunchMeal: Meal = {
        id: 'l1',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Lunch',
        title: 'Unknown Dish X', // Unavailable
        image_url: 'img',
        created_at: new Date().toISOString(),
      };

      const dinnerMeal: Meal = {
        id: 'd1',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Dinner',
        title: 'Butter Chicken', // 490 kcal
        image_url: 'bc.jpg',
        created_at: new Date().toISOString(),
      };

      const daily = calculateDailyCalories([breakfastMeal], [lunchMeal], [dinnerMeal]);
      // 160 + 490 = 650 kcal
      expect(daily.totalCalories).toBe(650);
      expect(daily.isComplete).toBe(false);
      expect(daily.hasUnavailable).toBe(true);
      expect(daily.unavailableCount).toBe(1);
      expect(daily.formattedText).toBe('650+ kcal (Incomplete)');
      expect(daily.compactText).toBe('650+ kcal*');
    });

    it('shows exact total when all planned meals have verified nutrition', () => {
      const breakfastMeal: Meal = {
        id: 'b2',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Breakfast',
        title: 'Crispy Masala Dosa', // 340 kcal
        image_url: 'dosa.jpg',
        created_at: new Date().toISOString(),
      };

      const lunchMeal: Meal = {
        id: 'l2',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Lunch',
        title: 'Kodi Kura', // 440 kcal
        image_url: 'kodi.jpg',
        created_at: new Date().toISOString(),
      };

      const dinnerMeal: Meal = {
        id: 'd2',
        household_id: 'h1',
        date: '2026-10-20',
        week_start: '2026-10-19',
        day_of_week: 'Tue',
        meal_type: 'Dinner',
        title: 'Chapati', // 290 kcal
        image_url: 'chapati.jpg',
        created_at: new Date().toISOString(),
      };

      const daily = calculateDailyCalories([breakfastMeal], [lunchMeal], [dinnerMeal]);
      // 340 + 440 + 290 = 1070 kcal
      expect(daily.totalCalories).toBe(1070);
      expect(daily.isComplete).toBe(true);
      expect(daily.hasUnavailable).toBe(false);
      expect(daily.formattedText).toBe('1,070 kcal');
      expect(daily.compactText).toBe('1,070 kcal');
    });
  });

  // =========================================================================
  // 6. Offline Caching
  // =========================================================================
  describe('6. Offline Caching of Verified Nutrition', () => {
    it('caches verified nutrition results for offline lookup', () => {
      const dish = 'My Special Quinoa Salad';
      expect(getCachedDishNutrition(dish)).toBeUndefined();

      setCachedDishNutrition(dish, {
        name: 'My Special Quinoa Salad',
        caloriesPerServing: 310,
        servingDescription: 'bowl',
        verified: true,
        source: 'manual',
      });

      const retrieved = getCachedDishNutrition(dish);
      expect(retrieved).toBeDefined();
      expect(retrieved?.caloriesPerServing).toBe(310);
      expect(retrieved?.source).toBe('manual');
    });

    it('lookupDishNutrition retrieves data from cache if present', () => {
      const dish = 'Grandma Secret Andhra Chutney';
      setCachedDishNutrition(dish, {
        name: 'Grandma Secret Andhra Chutney',
        caloriesPerServing: 115,
        servingDescription: 'serving',
        verified: true,
        source: 'manual',
      });

      const result = lookupDishNutrition(dish);
      expect(result).toBeDefined();
      expect(result?.caloriesPerServing).toBe(115);
    });
  });

  // =========================================================================
  // 7. Async Resolution & Graceful Failure
  // =========================================================================
  describe('7. Async Resolution Fallback and Safety', () => {
    it('resolves instantly for verified database entries without API call', async () => {
      const res = await resolveMealNutritionAsync('Pappu Charu');
      expect(res).toBeDefined();
      expect(res?.caloriesPerServing).toBe(140);
    });

    it('returns undefined gracefully without throwing if remote fetch fails or is offline', async () => {
      // Mock fetch failure
      const originalFetch = globalThis.fetch;
      globalThis.fetch = () => Promise.reject(new Error('Network offline'));

      try {
        const res = await resolveMealNutritionAsync('Completely Unknown Dish That Needs Web API 999');
        expect(res).toBeUndefined();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
