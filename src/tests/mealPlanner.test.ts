import { describe, it, expect } from 'vitest';
import { Meal, DayOfWeek, MealType } from '../sync/types';

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayInfo {
  date: string;
  dayOfWeek: DayOfWeek;
  dayName: string;
  monthShort: string;
  dayNumber: number;
  formattedHeader: string;
  formattedLong: string;
}

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

const findMealForSlot = (
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

describe('Meal Planner Date-Based Architecture & Data Isolation Tests', () => {
  // Test 1: Date generation
  it('1. Generates correct 7 days starting from Mon Sep 22 to Sun Sep 28', () => {
    const baseDate = new Date(2026, 8, 22);
    const weekDays = getWeekDays(baseDate);

    expect(weekDays).toHaveLength(7);
    expect(weekDays[0].formattedHeader).toBe('Mon — Sep 22');
    expect(weekDays[1].formattedHeader).toBe('Tue — Sep 23');
    expect(weekDays[2].formattedHeader).toBe('Wed — Sep 24');
    expect(weekDays[3].formattedHeader).toBe('Thu — Sep 25');
    expect(weekDays[4].formattedHeader).toBe('Fri — Sep 26');
    expect(weekDays[5].formattedHeader).toBe('Sat — Sep 27');
    expect(weekDays[6].formattedHeader).toBe('Sun — Sep 28');

    expect(formatWeekRange(weekDays)).toBe('Sep 22 – 28, 2026');
  });

  // Test 2: Next week navigation
  it('2. Advances 7 days correctly when navigating to next week', () => {
    const baseDate = new Date(2026, 8, 22);
    const nextWeekDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 7);
    const weekDays = getWeekDays(nextWeekDate);

    expect(weekDays[0].formattedHeader).toBe('Mon — Sep 29');
    expect(weekDays[1].formattedHeader).toBe('Tue — Sep 30');
    expect(weekDays[2].formattedHeader).toBe('Wed — Oct 1');
    expect(weekDays[6].formattedHeader).toBe('Sun — Oct 5');
    expect(formatWeekRange(weekDays)).toBe('Sep 29 – Oct 5, 2026');
  });

  // Test 3: Previous week navigation
  it('3. Rewinds 7 days correctly when navigating to previous week', () => {
    const baseDate = new Date(2026, 8, 22);
    const prevWeekDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 7);
    const weekDays = getWeekDays(prevWeekDate);

    expect(weekDays[0].formattedHeader).toBe('Mon — Sep 15');
    expect(weekDays[6].formattedHeader).toBe('Sun — Sep 21');
    expect(formatWeekRange(weekDays)).toBe('Sep 15 – 21, 2026');
  });

  // Test 4: Data Safety & Strict Isolation
  it('4. Data Safety: Changing Sep 22 Breakfast does NOT affect Sep 23 Breakfast, Sep 22 Lunch, or Sep 22 Dinner', () => {
    const initialMeals: Meal[] = [
      {
        id: 'm_mon_b',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Oats & Fruits',
        image_url: 'img_oats',
        created_at: '2026-09-22T08:00:00Z',
      },
      {
        id: 'm_mon_l',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Lunch',
        title: 'Lemon Rice',
        image_url: 'img_lemon',
        created_at: '2026-09-22T08:00:00Z',
      },
      {
        id: 'm_mon_d',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Dinner',
        title: 'Paneer Curry',
        image_url: 'img_paneer',
        created_at: '2026-09-22T08:00:00Z',
      },
      {
        id: 'm_tue_b',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Tue',
        meal_type: 'Breakfast',
        title: 'Idli & Chutney',
        image_url: 'img_idli',
        created_at: '2026-09-22T08:00:00Z',
      },
    ];

    // User changes Monday Sep 22 Breakfast to Crispy Masala Dosa
    const updatedMeals = initialMeals.map((m) =>
      m.id === 'm_mon_b'
        ? {
            ...m,
            date: '2026-09-22',
            title: 'Crispy Masala Dosa',
            image_url: 'img_dosa',
          }
        : m
    );

    const weekDays = getWeekDays(new Date(2026, 8, 22));
    const mon = weekDays[0];
    const tue = weekDays[1];

    // Mon Breakfast changed
    const monBreakfast = findMealForSlot(updatedMeals, mon, '2026-09-22', 'Breakfast');
    expect(monBreakfast?.title).toBe('Crispy Masala Dosa');

    // Mon Lunch unchanged
    const monLunch = findMealForSlot(updatedMeals, mon, '2026-09-22', 'Lunch');
    expect(monLunch?.title).toBe('Lemon Rice');

    // Mon Dinner unchanged
    const monDinner = findMealForSlot(updatedMeals, mon, '2026-09-22', 'Dinner');
    expect(monDinner?.title).toBe('Paneer Curry');

    // Tue Breakfast unchanged
    const tueBreakfast = findMealForSlot(updatedMeals, tue, '2026-09-22', 'Breakfast');
    expect(tueBreakfast?.title).toBe('Idli & Chutney');
  });

  // Test 5: Removing a meal
  it('5. Removing a meal clears that slot without affecting any other date or slot', () => {
    const meals: Meal[] = [
      {
        id: 'm_mon_b',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Breakfast',
        title: 'Oats & Fruits',
        image_url: 'img_oats',
        created_at: '2026-09-22T08:00:00Z',
      },
      {
        id: 'm_mon_l',
        household_id: 'h1',
        week_start: '2026-09-22',
        day_of_week: 'Mon',
        meal_type: 'Lunch',
        title: 'Lemon Rice',
        image_url: 'img_lemon',
        created_at: '2026-09-22T08:00:00Z',
      },
    ];

    // Remove Monday Breakfast
    const remainingMeals = meals.filter((m) => m.id !== 'm_mon_b');
    const weekDays = getWeekDays(new Date(2026, 8, 22));

    expect(findMealForSlot(remainingMeals, weekDays[0], '2026-09-22', 'Breakfast')).toBeUndefined();
    expect(findMealForSlot(remainingMeals, weekDays[0], '2026-09-22', 'Lunch')?.title).toBe('Lemon Rice');
  });

  // Test 6: Selecting a meal for a specific date (Sep 24 -> Dinner -> Chicken Curry)
  it('6. Specific date selection: Sep 24 Dinner -> Chicken Curry updates only Sep 24 Dinner', () => {
    const weekDays = getWeekDays(new Date(2026, 8, 22));
    const wedSep24 = weekDays[2];

    expect(wedSep24.date).toBe('2026-09-24');
    expect(wedSep24.formattedHeader).toBe('Wed — Sep 24');

    const newDinner: Meal = {
      id: 'meal_2026-09-24_dinner',
      household_id: 'h1',
      date: wedSep24.date,
      week_start: '2026-09-22',
      day_of_week: wedSep24.dayOfWeek,
      meal_type: 'Dinner',
      title: 'Chicken Curry',
      image_url: 'img_chicken',
      created_at: '2026-09-24T18:00:00Z',
    };

    const slotMeal = findMealForSlot([newDinner], wedSep24, '2026-09-22', 'Dinner');
    expect(slotMeal?.title).toBe('Chicken Curry');
    expect(slotMeal?.date).toBe('2026-09-24');

    // Does not match Lunch on the same day
    expect(findMealForSlot([newDinner], wedSep24, '2026-09-22', 'Lunch')).toBeUndefined();

    // Does not match Dinner on another day
    const thuSep25 = weekDays[3];
    expect(findMealForSlot([newDinner], thuSep25, '2026-09-22', 'Dinner')).toBeUndefined();
  });

  // Test 7: Automatic image update when meal changes (Oats & Fruits -> Dosa -> Idli & Chutney)
  it('7. Automatic image update: Changing Oats & Fruits to Dosa updates image to Dosa, then Idli to Idli image', async () => {
    const { getMealDefinition } = await import('../lib/mealCatalog');

    // 1. Oats & Fruits
    const oatsDef = getMealDefinition('Oats & Fruits');
    expect(oatsDef).toBeDefined();
    expect(oatsDef?.name).toBe('Oats & Fruits');
    expect(oatsDef?.image).toContain('photo-1517673132405');

    // 2. Change to Dosa
    const dosaDef = getMealDefinition('Dosa');
    expect(dosaDef).toBeDefined();
    expect(dosaDef?.name).toBe('Dosa');
    expect(dosaDef?.image).toContain('photo-1668236543090');
    // Ensure image is NOT oats image
    expect(dosaDef?.image).not.toBe(oatsDef?.image);

    // 3. Change to Idli & Chutney
    const idliDef = getMealDefinition('Idli & Chutney');
    expect(idliDef).toBeDefined();
    expect(idliDef?.name).toBe('Idli & Chutney');
    expect(idliDef?.image).toContain('photo-1589301760014');
    // Ensure image is NOT dosa or oats image
    expect(idliDef?.image).not.toBe(dosaDef?.image);
    expect(idliDef?.image).not.toBe(oatsDef?.image);
  });

  // Test 8: Custom meal dynamic image resolution and transitions
  it('8. Custom meal image resolution: wada and chatni -> chicken 65 -> mango rice', async () => {
    const { resolveFoodImage, getCachedMealImage, SAFE_FALLBACK_FOOD_IMAGE } = await import('../lib/foodImageResolver');
    const { getMealDefinition } = await import('../lib/mealCatalog');

    // 1. Existing Dosa -> Dosa image
    const dosa = getMealDefinition('Dosa');
    expect(dosa?.image).toContain('photo-1668236543090');

    // 2. Existing Idli & Chutney -> Idli image
    const idli = getMealDefinition('Idli & Chutney');
    expect(idli?.image).toContain('photo-1589301760014');

    // 3. Create custom "wada and chatni" -> Wada/Chutney image
    const wadaImg = await resolveFoodImage('wada and chatni');
    expect(wadaImg).toBeDefined();
    expect(wadaImg).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(wadaImg.toLowerCase()).toMatch(/wada|vada/);

    // 4. Change "wada and chatni" -> "chicken 65" -> Chicken 65 image
    const chickenImg = await resolveFoodImage('chicken 65');
    expect(chickenImg).toBeDefined();
    expect(chickenImg).not.toBe(wadaImg);
    expect(chickenImg.toLowerCase()).toMatch(/chicken/);

    // 5. Change "chicken 65" -> "mango rice" -> Mango Rice image
    const mangoImg = await resolveFoodImage('mango rice');
    expect(mangoImg).toBeDefined();
    expect(mangoImg).not.toBe(chickenImg);
    expect(mangoImg).not.toBe(wadaImg);

    // 6. Refresh / Cache: getCachedMealImage returns the resolved image
    expect(getCachedMealImage('wada and chatni')).toBe(wadaImg);
    expect(getCachedMealImage('chicken 65')).toBe(chickenImg);
    expect(getCachedMealImage('mango rice')).toBe(mangoImg);

    // 7. Custom meal object uses its own image, not previous meal's image
    const customMealObj = {
      title: 'wada and chatni',
      image_url: wadaImg,
    };
    const def = getMealDefinition(customMealObj);
    expect(def?.image).toBe(wadaImg);
    expect(def?.image).not.toBe(dosa?.image);
  });

  // Test 9: Arbitrary custom names across Breakfast, Lunch, and Dinner with non-reuse verification
  it('9. Arbitrary custom meals across Breakfast, Lunch, and Dinner change image to match typed meal name without reusing previous image', async () => {
    const { resolveMealImage, SAFE_FALLBACK_FOOD_IMAGE } = await import('../lib/foodImageResolver');
    const { getMealDefinition } = await import('../lib/mealCatalog');

    // 1. Breakfast slot: Oats & Fruits -> Chicken 65
    const initialBreakfast = getMealDefinition('Oats & Fruits');
    expect(initialBreakfast?.image).toContain('photo-1517673132405');

    const chicken65Image = await resolveMealImage('chicken 65');
    expect(chicken65Image).toBeDefined();
    expect(chicken65Image).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(chicken65Image).not.toBe(initialBreakfast?.image);
    expect(chicken65Image.toLowerCase()).toContain('chicken');

    // 2. Breakfast slot: Chicken 65 -> Wada and Chatni
    const wadaImage = await resolveMealImage('wada and chatni');
    expect(wadaImage).toBeDefined();
    expect(wadaImage).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(wadaImage).not.toBe(chicken65Image);
    expect(wadaImage).not.toBe(initialBreakfast?.image);
    expect(wadaImage.toLowerCase()).toMatch(/wada|vada/);

    // 3. Lunch slot: Veg Biryani -> Mushroom Fried Rice
    const initialLunch = getMealDefinition('Veg Biryani');
    const mushroomRiceImage = await resolveMealImage('mushroom fried rice');
    expect(mushroomRiceImage).toBeDefined();
    expect(mushroomRiceImage).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(mushroomRiceImage).not.toBe(initialLunch?.image);
    expect(mushroomRiceImage).not.toBe(wadaImage);
    expect(mushroomRiceImage.toLowerCase()).toMatch(/mushroom|rice/);

    // 4. Dinner slot: Dal Rice -> Paneer Tikka
    const initialDinner = getMealDefinition('Dal Rice');
    const paneerTikkaImage = await resolveMealImage('paneer tikka');
    expect(paneerTikkaImage).toBeDefined();
    expect(paneerTikkaImage).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(paneerTikkaImage).not.toBe(initialDinner?.image);
    expect(paneerTikkaImage).not.toBe(mushroomRiceImage);
    expect(paneerTikkaImage.toLowerCase()).toMatch(/paneer|tikka/);

    // 5. Verify meal object preserves its own image as single source of truth
    const customMealSlot = {
      id: 'm_test_slot',
      recipe_id: undefined,
      title: 'chicken 65',
      image_url: chicken65Image,
    };
    const resolvedSlot = getMealDefinition(customMealSlot);
    expect(resolvedSlot?.image).toBe(chicken65Image);
    expect(resolvedSlot?.image).not.toBe(initialBreakfast?.image);
  });
});
