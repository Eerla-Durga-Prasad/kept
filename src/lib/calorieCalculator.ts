// Calorie Calculation and Nutrition Engine for Kept Meal Planner
// Reference standards: ICMR-NIN Indian Food Composition Tables & USDA FoodData Central

import { Meal, Recipe } from '../sync/types';

export interface NutritionItem {
  name: string;
  caloriesPerServing: number;
  servingDescription: string;
  verified: boolean;
  source: string;
}

export interface CalorieCalculationResult {
  calories: number | null; // null if unavailable
  isEstimate: boolean;
  servingSize: number; // e.g. 1, 1.5, 2
  baseCalories: number | null; // calories per 1 standard serving
  source: 'recipe' | 'verified_catalog' | 'multi_item' | 'unavailable' | 'manual';
  details?: string;
  matchedDishName?: string;
  subItems?: { name: string; calories: number | null; isEstimate: boolean }[];
}

export interface CategoryCalorieTotal {
  totalCalories: number;
  hasUnavailable: boolean;
  unavailableCount: number;
  mealCount: number;
  isComplete: boolean;
  formattedText: string; // e.g. "540 kcal", "540+ kcal (Incomplete)", "Calories unavailable", "—"
  compactText?: string; // e.g. "540 kcal", "540+ kcal*", "Calories unavailable", "—"
}

export interface DailyCalorieTotal {
  breakfast: CategoryCalorieTotal;
  lunch: CategoryCalorieTotal;
  dinner: CategoryCalorieTotal;
  totalCalories: number;
  hasUnavailable: boolean;
  unavailableCount: number;
  totalMealCount: number;
  isComplete: boolean;
  formattedText: string; // e.g. "1,840 kcal", "1,200+ kcal (Incomplete)", "Calories unavailable", "No meals planned"
  compactText?: string; // e.g. "1,840 kcal", "1,200+ kcal*", "Calories unavailable", "No meals"
}

export interface WeeklyCalorieTotal {
  totalCalories: number;
  hasUnavailable: boolean;
  unavailableCount: number;
  totalMealCount: number;
  plannedDaysCount: number;
  isComplete: boolean;
  formattedText: string; // e.g. "12,880 kcal", "10,200+ kcal (Incomplete)", "Calories unavailable", "No meals planned"
  compactText: string; // e.g. "12,880 kcal", "10,200+ kcal*", "Calories unavailable", "No meals"
  averageDailyCalories: number | null; // e.g. average calories per planned day
  breakfastTotalCalories: number;
  lunchTotalCalories: number;
  dinnerTotalCalories: number;
}

/**
 * Verified Nutritional Database for Indian & International dishes.
 * Nutrition is normalized per single standard serving portion.
 */
export const VERIFIED_NUTRITION_DATABASE: Record<string, NutritionItem> = {
  // --- South Indian Classics ---
  'crispy masala dosa': {
    name: 'Crispy Masala Dosa',
    caloriesPerServing: 340,
    servingDescription: '1 large dosa with spiced potato filling & chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'masala dosa': {
    name: 'Masala Dosa',
    caloriesPerServing: 340,
    servingDescription: '1 large dosa with spiced potato filling & chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dosa': {
    name: 'Dosa',
    caloriesPerServing: 340,
    servingDescription: '1 serving with potato masala and chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'plain dosa': {
    name: 'Plain Dosa',
    caloriesPerServing: 210,
    servingDescription: '1 plain roasted dosa with coconut chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'steamed idli with sambar & chutney': {
    name: 'Steamed Idli with Sambar & Chutney',
    caloriesPerServing: 280,
    servingDescription: '2 steamed idlis + 1 bowl sambar + chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'idli & chutney': {
    name: 'Idli & Chutney',
    caloriesPerServing: 280,
    servingDescription: '2 steamed idlis with coconut chutney & sambar',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'idli': {
    name: 'Idli',
    caloriesPerServing: 160,
    servingDescription: '2 steamed idlis (approx 120g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'crispy medu vada': {
    name: 'Crispy Medu Vada',
    caloriesPerServing: 310,
    servingDescription: '2 crispy urad dal medu vadas with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'wada and chatni': {
    name: 'Wada and Chatni',
    caloriesPerServing: 310,
    servingDescription: '2 medu wadas served with coconut chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'medu vada': {
    name: 'Medu Vada',
    caloriesPerServing: 310,
    servingDescription: '2 crispy urad dal medu vadas with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'vada': {
    name: 'Vada',
    caloriesPerServing: 310,
    servingDescription: '2 vadas with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'classic rava upma': {
    name: 'Classic Rava Upma',
    caloriesPerServing: 260,
    servingDescription: '1 medium bowl (approx 180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'upma': {
    name: 'Upma',
    caloriesPerServing: 260,
    servingDescription: '1 medium bowl (approx 180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'andhra pesarattu with upma': {
    name: 'Andhra Pesarattu with Upma',
    caloriesPerServing: 330,
    servingDescription: '1 whole moong dal crepe stuffed with upma',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pesarattu': {
    name: 'Pesarattu',
    caloriesPerServing: 240,
    servingDescription: '1 moong dal crepe with ginger pachadi',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'fluffy onion uttapam': {
    name: 'Fluffy Onion Uttapam',
    caloriesPerServing: 290,
    servingDescription: '1 medium uttapam topped with shallots & chilies',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'onion uttapam': {
    name: 'Onion Uttapam',
    caloriesPerServing: 290,
    servingDescription: '1 medium uttapam with onion topping',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'uttapam': {
    name: 'Uttapam',
    caloriesPerServing: 280,
    servingDescription: '1 medium thick rice-lentil pancake',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'aromatic tomato rasam': {
    name: 'Aromatic Tomato Rasam',
    caloriesPerServing: 90,
    servingDescription: '1 bowl clear tomato-pepper rasam (180ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'tomato rasam': {
    name: 'Tomato Rasam',
    caloriesPerServing: 90,
    servingDescription: '1 bowl tomato rasam (180ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'rasam': {
    name: 'Rasam',
    caloriesPerServing: 80,
    servingDescription: '1 bowl rasam (180ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },

  // --- Andhra & Telangana Regional Specialties ---
  'andhra chicken curry (kodi kura)': {
    name: 'Andhra Chicken Curry (Kodi Kura)',
    caloriesPerServing: 440,
    servingDescription: '1 portion spicy country chicken curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'andhra chicken curry': {
    name: 'Andhra Chicken Curry',
    caloriesPerServing: 440,
    servingDescription: '1 portion spicy chicken curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chicken curry': {
    name: 'Chicken Curry',
    caloriesPerServing: 440,
    servingDescription: '1 portion chicken curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'andhra tomato pappu': {
    name: 'Andhra Tomato Pappu',
    caloriesPerServing: 260,
    servingDescription: '1 portion stewed toor dal with tomatoes & ghee',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'tomato pappu': {
    name: 'Tomato Pappu',
    caloriesPerServing: 260,
    servingDescription: '1 portion toor dal stew with tomatoes (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pappu': {
    name: 'Pappu',
    caloriesPerServing: 230,
    servingDescription: '1 portion cooked toor dal (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'traditional andhra pulihora': {
    name: 'Traditional Andhra Pulihora',
    caloriesPerServing: 340,
    servingDescription: '1 plate tangy tamarind peanut rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pulihora': {
    name: 'Pulihora',
    caloriesPerServing: 340,
    servingDescription: '1 plate tamarind rice with peanuts (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'tamarind rice': {
    name: 'Tamarind Rice',
    caloriesPerServing: 340,
    servingDescription: '1 plate tamarind rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'crispy mysore bonda': {
    name: 'Crispy Mysore Bonda',
    caloriesPerServing: 310,
    servingDescription: '3 golden yogurt fritters with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mysore bonda': {
    name: 'Mysore Bonda',
    caloriesPerServing: 310,
    servingDescription: '3 golden yogurt fritters',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'crispy andhra punugulu': {
    name: 'Crispy Andhra Punugulu',
    caloriesPerServing: 290,
    servingDescription: '6-8 bite-sized crunchy rice-batter fritters',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'punugulu': {
    name: 'Punugulu',
    caloriesPerServing: 290,
    servingDescription: '6-8 bite-sized crunchy fritters with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'hyderabadi dum biryani': {
    name: 'Hyderabadi Dum Biryani',
    caloriesPerServing: 420,
    servingDescription: '1 plate layered basmati biryani with raita (250g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'veg biryani': {
    name: 'Veg Biryani',
    caloriesPerServing: 420,
    servingDescription: '1 plate vegetable biryani (250g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'biryani': {
    name: 'Biryani',
    caloriesPerServing: 420,
    servingDescription: '1 plate biryani (250g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },

  // --- North Indian Classics ---
  'paneer butter masala': {
    name: 'Paneer Butter Masala',
    caloriesPerServing: 410,
    servingDescription: '1 bowl paneer in creamy makhani gravy (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'paneer curry': {
    name: 'Paneer Curry',
    caloriesPerServing: 410,
    servingDescription: '1 bowl rich paneer curry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'comfort dal tadka': {
    name: 'Comfort Dal Tadka',
    caloriesPerServing: 210,
    servingDescription: '1 bowl yellow dal with ghee cumin garlic tadka',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dal tadka': {
    name: 'Dal Tadka',
    caloriesPerServing: 210,
    servingDescription: '1 bowl yellow dal with ghee cumin tadka (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dal rice': {
    name: 'Dal Rice',
    caloriesPerServing: 360,
    servingDescription: '1 plate steamed rice + 1 bowl dal with ghee',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'amritsari chole bhature': {
    name: 'Amritsari Chole Bhature',
    caloriesPerServing: 550,
    servingDescription: '1 bowl spiced chickpea curry + 1 puffed bhatura',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chole bhature': {
    name: 'Chole Bhature',
    caloriesPerServing: 550,
    servingDescription: '1 bowl spiced chickpea curry + 1 bhatura',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dhaba style palak paneer': {
    name: 'Dhaba Style Palak Paneer',
    caloriesPerServing: 340,
    servingDescription: '1 bowl spinach paneer curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'palak paneer': {
    name: 'Palak Paneer',
    caloriesPerServing: 340,
    servingDescription: '1 bowl spinach paneer curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'garlic butter naan': {
    name: 'Garlic Butter Naan',
    caloriesPerServing: 280,
    servingDescription: '1 soft tandoori naan brushed with garlic butter',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'butter naan': {
    name: 'Butter Naan',
    caloriesPerServing: 270,
    servingDescription: '1 soft tandoori butter naan',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'naan': {
    name: 'Naan',
    caloriesPerServing: 240,
    servingDescription: '1 plain tandoori naan',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },

  // --- Rice, Comfort & Breakfast Favorites ---
  'tangy lemon rice (chitranna)': {
    name: 'Tangy Lemon Rice (Chitranna)',
    caloriesPerServing: 320,
    servingDescription: '1 plate lemon peanut turmeric rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'lemon rice': {
    name: 'Lemon Rice',
    caloriesPerServing: 320,
    servingDescription: '1 plate lemon peanut rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'restaurant style veg fried rice': {
    name: 'Restaurant Style Veg Fried Rice',
    caloriesPerServing: 350,
    servingDescription: '1 plate wok-tossed vegetable fried rice (220g)',
    verified: true,
    source: 'USDA FoodData Central / NIN',
  },
  'veg fried rice': {
    name: 'Veg Fried Rice',
    caloriesPerServing: 350,
    servingDescription: '1 plate vegetable fried rice (220g)',
    verified: true,
    source: 'USDA FoodData Central / NIN',
  },
  'fried rice': {
    name: 'Fried Rice',
    caloriesPerServing: 350,
    servingDescription: '1 plate fried rice (220g)',
    verified: true,
    source: 'USDA FoodData Central / NIN',
  },
  'oats & fruits': {
    name: 'Oats & Fruits',
    caloriesPerServing: 290,
    servingDescription: '1 bowl rolled oats with milk, banana & berries',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'poha': {
    name: 'Poha',
    caloriesPerServing: 250,
    servingDescription: '1 plate flattened rice with peanuts & onions (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pancakes': {
    name: 'Pancakes',
    caloriesPerServing: 350,
    servingDescription: '2 medium fluffy pancakes with light maple drizzle',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'smoothie bowl': {
    name: 'Smoothie Bowl',
    caloriesPerServing: 310,
    servingDescription: '1 bowl blended fruit smoothie with chia & nuts',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'roti & curry': {
    name: 'Roti & Curry',
    caloriesPerServing: 380,
    servingDescription: '2 whole wheat rotis + 1 bowl mixed veg curry',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'curd rice': {
    name: 'Curd Rice',
    caloriesPerServing: 240,
    servingDescription: '1 bowl tempered yogurt rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pulao': {
    name: 'Pulao',
    caloriesPerServing: 330,
    servingDescription: '1 plate mild vegetable pulao (220g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chapati': {
    name: 'Chapati',
    caloriesPerServing: 290,
    servingDescription: '2 whole wheat chapatis with light ghee & sabzi',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chapati & sabzi': {
    name: 'Chapati & Sabzi',
    caloriesPerServing: 290,
    servingDescription: '2 chapatis + 1 portion vegetable sabzi',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'veg soup': {
    name: 'Veg Soup',
    caloriesPerServing: 120,
    servingDescription: '1 bowl clear vegetable broth soup (220ml)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'chicken 65': {
    name: 'Chicken 65',
    caloriesPerServing: 380,
    servingDescription: '1 portion spiced fried chicken bites (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mango rice': {
    name: 'Mango Rice',
    caloriesPerServing: 330,
    servingDescription: '1 plate spiced raw mango rice with peanuts (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mushroom fried rice': {
    name: 'Mushroom Fried Rice',
    caloriesPerServing: 340,
    servingDescription: '1 plate wok-tossed mushroom fried rice (220g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'paneer tikka': {
    name: 'Paneer Tikka',
    caloriesPerServing: 320,
    servingDescription: '6 pieces grilled marinated paneer cubes',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },

  // --- Sweets & International ---
  'gulab jamun with rose cardamom syrup': {
    name: 'Gulab Jamun with Rose Cardamom Syrup',
    caloriesPerServing: 300,
    servingDescription: '2 mawa dumplings in warm rose cardamom syrup',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gulab jamun': {
    name: 'Gulab Jamun',
    caloriesPerServing: 300,
    servingDescription: '2 pieces with sugar syrup',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'classic margherita pizza': {
    name: 'Classic Margherita Pizza',
    caloriesPerServing: 450,
    servingDescription: '2 slices / 1 personal thin crust pizza (180g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'margherita pizza': {
    name: 'Margherita Pizza',
    caloriesPerServing: 450,
    servingDescription: '2 slices cheese pizza (180g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'pizza': {
    name: 'Pizza',
    caloriesPerServing: 450,
    servingDescription: '2 slices pizza (approx 180g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'creamy penne alfredo pasta': {
    name: 'Creamy Penne Alfredo Pasta',
    caloriesPerServing: 490,
    servingDescription: '1 plate penne in garlic parmesan cream sauce (220g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'penne alfredo': {
    name: 'Penne Alfredo',
    caloriesPerServing: 490,
    servingDescription: '1 plate penne in cream sauce (220g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'pasta': {
    name: 'Pasta',
    caloriesPerServing: 490,
    servingDescription: '1 plate pasta in sauce (220g)',
    verified: true,
    source: 'USDA FoodData Central',
  },

  // --- Common Sub-Items / Side Components for Multi-item Meals ---
  'sambar': {
    name: 'Sambar',
    caloriesPerServing: 110,
    servingDescription: '1 bowl lentil & vegetable sambar (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'coconut chutney': {
    name: 'Coconut Chutney',
    caloriesPerServing: 70,
    servingDescription: '2 tablespoons fresh coconut chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chutney': {
    name: 'Chutney',
    caloriesPerServing: 60,
    servingDescription: '2 tablespoons chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'boiled egg': {
    name: 'Boiled Egg',
    caloriesPerServing: 75,
    servingDescription: '1 whole hard-boiled egg',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'egg omelette': {
    name: 'Egg Omelette',
    caloriesPerServing: 190,
    servingDescription: '2-egg omelette cooked with onions & green chilies',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'scrambled eggs': {
    name: 'Scrambled Eggs',
    caloriesPerServing: 180,
    servingDescription: '2 eggs softly scrambled with butter',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'steamed rice': {
    name: 'Steamed Rice',
    caloriesPerServing: 205,
    servingDescription: '1 cup cooked white rice (150g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'white rice': {
    name: 'White Rice',
    caloriesPerServing: 205,
    servingDescription: '1 cup cooked white rice (150g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'roti': {
    name: 'Roti',
    caloriesPerServing: 100,
    servingDescription: '1 whole wheat phulka / roti',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'curd': {
    name: 'Curd',
    caloriesPerServing: 100,
    servingDescription: '1 cup homemade plain curd (150g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'yogurt': {
    name: 'Yogurt',
    caloriesPerServing: 100,
    servingDescription: '1 cup plain yogurt (150g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'salad': {
    name: 'Fresh Salad',
    caloriesPerServing: 45,
    servingDescription: '1 bowl cucumber, tomato & carrot salad with lemon',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },

  // --- Andhra, Telangana & Regional Indian Dishes & Telugu Names ---
  'kodi kura': {
    name: 'Andhra Chicken Curry (Kodi Kura)',
    caloriesPerServing: 440,
    servingDescription: '1 portion spicy country chicken curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'kodi vepudu': {
    name: 'Andhra Chicken Fry (Kodi Vepudu)',
    caloriesPerServing: 390,
    servingDescription: '1 portion pan-fried spiced chicken (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chepala pulusu': {
    name: 'Andhra Chepala Pulusu',
    caloriesPerServing: 320,
    servingDescription: '1 bowl tangy tamarind fish curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'fish curry': {
    name: 'Fish Curry',
    caloriesPerServing: 320,
    servingDescription: '1 portion fish curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'natu kodi pulusu': {
    name: 'Natu Kodi Pulusu',
    caloriesPerServing: 460,
    servingDescription: '1 portion rich country chicken gravy (220g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mamsam kura': {
    name: 'Andhra Mutton Curry (Mamsam Kura)',
    caloriesPerServing: 510,
    servingDescription: '1 bowl slow-cooked tender mutton curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mutton curry': {
    name: 'Mutton Curry',
    caloriesPerServing: 510,
    servingDescription: '1 bowl tender mutton curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gongura mamsam': {
    name: 'Gongura Mamsam',
    caloriesPerServing: 530,
    servingDescription: '1 portion spiced lamb with tangy sorrel leaves (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gongura chicken': {
    name: 'Gongura Chicken',
    caloriesPerServing: 460,
    servingDescription: '1 portion chicken simmered in tangy gongura gravy (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gongura pappu': {
    name: 'Gongura Pappu',
    caloriesPerServing: 240,
    servingDescription: '1 bowl toor dal stewed with tangy sorrel leaves (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'palakura pappu': {
    name: 'Palakura Pappu',
    caloriesPerServing: 220,
    servingDescription: '1 bowl spinach dal with garlic tadka (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dosakaya pappu': {
    name: 'Dosakaya Pappu',
    caloriesPerServing: 230,
    servingDescription: '1 bowl yellow cucumber lentil stew (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pappu charu': {
    name: 'Andhra Pappu Charu',
    caloriesPerServing: 140,
    servingDescription: '1 bowl stewed lentil-tamarind broth with vegetables (180ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'majjiga pulusu': {
    name: 'Majjiga Pulusu',
    caloriesPerServing: 160,
    servingDescription: '1 bowl seasoned buttermilk vegetable stew (180ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'majiga pulusu': {
    name: 'Majjiga Pulusu',
    caloriesPerServing: 160,
    servingDescription: '1 bowl seasoned buttermilk stew (180ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gutti vankaya kura': {
    name: 'Gutti Vankaya Kura',
    caloriesPerServing: 280,
    servingDescription: '1 portion peanut-sesame stuffed baby brinjals (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gutti vankaya': {
    name: 'Gutti Vankaya',
    caloriesPerServing: 280,
    servingDescription: '1 portion stuffed baby brinjal curry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'vankaya kura': {
    name: 'Vankaya Kura',
    caloriesPerServing: 190,
    servingDescription: '1 portion spiced brinjal curry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'bendakaya vepudu': {
    name: 'Bendakaya Vepudu',
    caloriesPerServing: 180,
    servingDescription: '1 portion crispy roasted okra fry with peanuts (150g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dondakaya vepudu': {
    name: 'Dondakaya Vepudu',
    caloriesPerServing: 170,
    servingDescription: '1 portion tindora / ivy gourd fry (150g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'aloo vepudu': {
    name: 'Aloo Vepudu',
    caloriesPerServing: 240,
    servingDescription: '1 portion roasted spiced potato cubes (150g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'alasanda vada': {
    name: 'Alasanda Vada',
    caloriesPerServing: 290,
    servingDescription: '3 crispy black-eyed pea patties',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'garelu': {
    name: 'Minapa Garelu (Medu Vada)',
    caloriesPerServing: 310,
    servingDescription: '2 crispy urad dal garelu with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chitti garelu': {
    name: 'Chitti Garelu',
    caloriesPerServing: 260,
    servingDescription: '6 bite-sized mini garelu with ginger chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'attu': {
    name: 'Plain Attu (Dosa)',
    caloriesPerServing: 210,
    servingDescription: '1 golden roasted crepe with chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'minapa attu': {
    name: 'Minapa Attu',
    caloriesPerServing: 210,
    servingDescription: '1 lentil crepe with ginger chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'daddojanam': {
    name: 'Daddojanam (Curd Rice)',
    caloriesPerServing: 260,
    servingDescription: '1 bowl tempered yogurt rice with mustard & curry leaves (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'kobbari annam': {
    name: 'Kobbari Annam (Coconut Rice)',
    caloriesPerServing: 360,
    servingDescription: '1 plate aromatic coconut tempered rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'kobbari pachadi': {
    name: 'Kobbari Pachadi',
    caloriesPerServing: 70,
    servingDescription: '2 tablespoons fresh coconut chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'allam pachadi': {
    name: 'Allam Pachadi (Ginger Chutney)',
    caloriesPerServing: 65,
    servingDescription: '2 tablespoons tangy sweet ginger chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'tomato pachadi': {
    name: 'Tomato Pachadi',
    caloriesPerServing: 60,
    servingDescription: '2 tablespoons roasted tomato chili chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gongura pachadi': {
    name: 'Gongura Pachadi',
    caloriesPerServing: 75,
    servingDescription: '2 tablespoons roasted sorrel leaves pickle relish',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'bobbatlu': {
    name: 'Bobbatlu (Puran Poli)',
    caloriesPerServing: 280,
    servingDescription: '1 sweet flatbread stuffed with chana dal & jaggery',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'bakshalu': {
    name: 'Bakshalu (Bobbatlu)',
    caloriesPerServing: 280,
    servingDescription: '1 sweet jaggery lentil stuffed flatbread',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'puran poli': {
    name: 'Puran Poli',
    caloriesPerServing: 280,
    servingDescription: '1 sweet jaggery stuffed flatbread with ghee',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'ariselu': {
    name: 'Ariselu',
    caloriesPerServing: 290,
    servingDescription: '1 traditional jaggery rice flour sweet cake',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'poornam boorelu': {
    name: 'Poornam Boorelu',
    caloriesPerServing: 270,
    servingDescription: '2 sweet golden stuffed lentil dumplings',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'boorelu': {
    name: 'Boorelu',
    caloriesPerServing: 270,
    servingDescription: '2 traditional sweet dumplings',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'sunnundalu': {
    name: 'Sunnundalu',
    caloriesPerServing: 220,
    servingDescription: '1 roasted urad dal & ghee round laddu',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'paramannam': {
    name: 'Bellam Paramannam (Sweet Rice)',
    caloriesPerServing: 290,
    servingDescription: '1 bowl rice cooked with jaggery, milk & ghee (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'payasam': {
    name: 'Payasam',
    caloriesPerServing: 260,
    servingDescription: '1 bowl milk vermicelli payasam with cashews (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'ragi sankati': {
    name: 'Ragi Sankati (Ragi Mudde)',
    caloriesPerServing: 280,
    servingDescription: '1 finger millet dumpling ball with sambar/curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'ragi sangati': {
    name: 'Ragi Sangati',
    caloriesPerServing: 280,
    servingDescription: '1 ragi ball (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'ragi mudde': {
    name: 'Ragi Mudde',
    caloriesPerServing: 280,
    servingDescription: '1 steamed ragi ball (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'royyala vepudu': {
    name: 'Royyala Vepudu (Prawn Fry)',
    caloriesPerServing: 310,
    servingDescription: '1 portion spiced coastal prawn fry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'kodi guddu kura': {
    name: 'Kodi Guddu Kura (Egg Curry)',
    caloriesPerServing: 260,
    servingDescription: '2 hard-boiled eggs simmered in onion-tomato gravy',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'egg curry': {
    name: 'Egg Curry',
    caloriesPerServing: 260,
    servingDescription: '2 eggs in spiced curry gravy (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'egg bhurji': {
    name: 'Egg Bhurji',
    caloriesPerServing: 210,
    servingDescription: '2 eggs scrambled with spiced onions, chilies & tomatoes',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mirchi bajji': {
    name: 'Mirchi Bajji',
    caloriesPerServing: 220,
    servingDescription: '2 battered and fried spiced green chili fritters',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'poori bhaji': {
    name: 'Poori Bhaji',
    caloriesPerServing: 380,
    servingDescription: '2 puffed golden pooris with spiced potato curry',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'poori masala': {
    name: 'Poori Masala',
    caloriesPerServing: 380,
    servingDescription: '2 pooris with potato masala',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'poori': {
    name: 'Poori',
    caloriesPerServing: 240,
    servingDescription: '2 puffed whole wheat pooris',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'puri': {
    name: 'Puri',
    caloriesPerServing: 240,
    servingDescription: '2 puffed whole wheat puris',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'aloo paratha': {
    name: 'Aloo Paratha',
    caloriesPerServing: 290,
    servingDescription: '1 spiced potato stuffed whole wheat paratha with butter',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'gobi paratha': {
    name: 'Gobi Paratha',
    caloriesPerServing: 260,
    servingDescription: '1 spiced cauliflower stuffed paratha',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'paneer paratha': {
    name: 'Paneer Paratha',
    caloriesPerServing: 330,
    servingDescription: '1 spiced cottage cheese stuffed paratha',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'methi thepla': {
    name: 'Methi Thepla',
    caloriesPerServing: 130,
    servingDescription: '1 spiced fenugreek whole wheat flatbread',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'thepla': {
    name: 'Thepla',
    caloriesPerServing: 130,
    servingDescription: '1 spiced thepla flatbread',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'paratha': {
    name: 'Paratha',
    caloriesPerServing: 240,
    servingDescription: '1 layered whole wheat paratha',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'samosa': {
    name: 'Samosa',
    caloriesPerServing: 260,
    servingDescription: '1 large crispy spiced potato pea pastry',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pav bhaji': {
    name: 'Pav Bhaji',
    caloriesPerServing: 480,
    servingDescription: '2 butter toasted pavs + 1 plate spiced vegetable mash',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'vada pav': {
    name: 'Vada Pav',
    caloriesPerServing: 320,
    servingDescription: '1 spiced potato fritter in soft pav with garlic chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dhokla': {
    name: 'Khaman Dhokla',
    caloriesPerServing: 160,
    servingDescription: '3 pieces steamed fermented gram flour cake with mustard tadka',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pani puri': {
    name: 'Pani Puri',
    caloriesPerServing: 180,
    servingDescription: '6 crisp puris with spiced potato & mint water',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'bhel puri': {
    name: 'Bhel Puri',
    caloriesPerServing: 210,
    servingDescription: '1 plate puffed rice tossed with sev, onions & tamarind chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'sev puri': {
    name: 'Sev Puri',
    caloriesPerServing: 240,
    servingDescription: '1 plate crisp flat puris topped with potatoes & sev',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'butter chicken': {
    name: 'Butter Chicken (Murgh Makhani)',
    caloriesPerServing: 490,
    servingDescription: '1 portion tender tandoori chicken in velvety tomato-butter gravy (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chicken tikka masala': {
    name: 'Chicken Tikka Masala',
    caloriesPerServing: 450,
    servingDescription: '1 portion grilled chicken chunks in rich spiced curry (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'dal makhani': {
    name: 'Dal Makhani',
    caloriesPerServing: 340,
    servingDescription: '1 bowl slow-cooked black lentils in creamy butter gravy (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'kadai paneer': {
    name: 'Kadai Paneer',
    caloriesPerServing: 350,
    servingDescription: '1 bowl paneer with bell peppers and freshly ground kadai spices (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'shahi paneer': {
    name: 'Shahi Paneer',
    caloriesPerServing: 390,
    servingDescription: '1 bowl paneer in rich cashew-cream royal gravy (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'matar paneer': {
    name: 'Matar Paneer',
    caloriesPerServing: 310,
    servingDescription: '1 bowl green peas and paneer in spiced gravy (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chole masala': {
    name: 'Chole Masala',
    caloriesPerServing: 290,
    servingDescription: '1 bowl Punjabi chickpea curry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chole': {
    name: 'Chole',
    caloriesPerServing: 290,
    servingDescription: '1 bowl spiced chickpea curry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'rajma chawal': {
    name: 'Rajma Chawal',
    caloriesPerServing: 410,
    servingDescription: '1 plate steamed rice + 1 bowl red kidney bean curry',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'rajma masala': {
    name: 'Rajma Masala',
    caloriesPerServing: 260,
    servingDescription: '1 bowl spiced red kidney bean stew (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'rajma': {
    name: 'Rajma',
    caloriesPerServing: 260,
    servingDescription: '1 bowl kidney bean curry (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'aloo gobi': {
    name: 'Aloo Gobi',
    caloriesPerServing: 210,
    servingDescription: '1 bowl stir-fried spiced potatoes and cauliflower (180g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'khichdi': {
    name: 'Moong Dal Khichdi',
    caloriesPerServing: 310,
    servingDescription: '1 bowl comfort rice and lentil porridge with ghee (220g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'pongal': {
    name: 'Ven Pongal',
    caloriesPerServing: 310,
    servingDescription: '1 bowl pepper cumin tempered rice-lentil pongal (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'ven pongal': {
    name: 'Ven Pongal',
    caloriesPerServing: 310,
    servingDescription: '1 bowl ghee pepper pongal with cashews (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chicken biryani': {
    name: 'Chicken Biryani',
    caloriesPerServing: 540,
    servingDescription: '1 plate fragrant basmati chicken biryani (300g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'mutton biryani': {
    name: 'Mutton Biryani',
    caloriesPerServing: 620,
    servingDescription: '1 plate slow-cooked mutton biryani (300g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'egg biryani': {
    name: 'Egg Biryani',
    caloriesPerServing: 460,
    servingDescription: '1 plate spiced basmati rice with boiled eggs (280g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'ghee rice': {
    name: 'Ghee Rice',
    caloriesPerServing: 380,
    servingDescription: '1 plate aromatic clarified butter basmati rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'jeera rice': {
    name: 'Jeera Rice',
    caloriesPerServing: 270,
    servingDescription: '1 plate cumin tempered basmati rice (200g)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chilli chicken': {
    name: 'Chilli Chicken',
    caloriesPerServing: 390,
    servingDescription: '1 portion Indo-Chinese tossed chicken with peppers (180g)',
    verified: true,
    source: 'USDA FoodData Central / NIN',
  },
  'chilli paneer': {
    name: 'Chilli Paneer',
    caloriesPerServing: 360,
    servingDescription: '1 portion Indo-Chinese tossed paneer cubes (180g)',
    verified: true,
    source: 'USDA FoodData Central / NIN',
  },
  'egg fried rice': {
    name: 'Egg Fried Rice',
    caloriesPerServing: 380,
    servingDescription: '1 plate wok-tossed egg fried rice (220g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'chicken fried rice': {
    name: 'Chicken Fried Rice',
    caloriesPerServing: 420,
    servingDescription: '1 plate wok-tossed chicken fried rice (240g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'veg hakka noodles': {
    name: 'Veg Hakka Noodles',
    caloriesPerServing: 360,
    servingDescription: '1 plate wok-tossed vegetable noodles (220g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'chicken hakka noodles': {
    name: 'Chicken Hakka Noodles',
    caloriesPerServing: 440,
    servingDescription: '1 plate wok-tossed chicken noodles (240g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'veg sandwich': {
    name: 'Vegetable Sandwich',
    caloriesPerServing: 240,
    servingDescription: '2 toasted slices with cucumber, tomato & mint chutney',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'sandwich': {
    name: 'Sandwich',
    caloriesPerServing: 240,
    servingDescription: '2 slices sandwich with vegetable filling',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'grilled cheese': {
    name: 'Grilled Cheese Sandwich',
    caloriesPerServing: 340,
    servingDescription: 'Golden grilled cheese sandwich',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'veg burger': {
    name: 'Veg Burger',
    caloriesPerServing: 380,
    servingDescription: '1 vegetable patty burger with lettuce & tomato',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'chicken burger': {
    name: 'Chicken Burger',
    caloriesPerServing: 460,
    servingDescription: '1 grilled chicken burger',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'fruit bowl': {
    name: 'Fresh Fruit Bowl',
    caloriesPerServing: 110,
    servingDescription: '1 bowl assorted fresh seasonal fruits (180g)',
    verified: true,
    source: 'USDA FoodData Central',
  },
  'masala chai': {
    name: 'Masala Chai',
    caloriesPerServing: 80,
    servingDescription: '1 cup brewed tea with milk and ginger-cardamom spices (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'chai': {
    name: 'Chai',
    caloriesPerServing: 80,
    servingDescription: '1 cup tea with milk and sugar (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'tea': {
    name: 'Tea',
    caloriesPerServing: 80,
    servingDescription: '1 cup tea with milk and sugar (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'filter coffee': {
    name: 'South Indian Filter Coffee',
    caloriesPerServing: 90,
    servingDescription: '1 cup frothy filter coffee with milk and sugar (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'coffee': {
    name: 'Coffee',
    caloriesPerServing: 90,
    servingDescription: '1 cup coffee with milk and sugar (150ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'sweet lassi': {
    name: 'Sweet Lassi',
    caloriesPerServing: 210,
    servingDescription: '1 tall glass sweet blended yogurt drink (200ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'lassi': {
    name: 'Lassi',
    caloriesPerServing: 210,
    servingDescription: '1 glass blended yogurt drink (200ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'buttermilk': {
    name: 'Spiced Buttermilk (Majjiga)',
    caloriesPerServing: 50,
    servingDescription: '1 glass tempered churned buttermilk with ginger & cilantro (200ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'majjiga': {
    name: 'Majjiga (Buttermilk)',
    caloriesPerServing: 50,
    servingDescription: '1 glass seasoned buttermilk (200ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
  'majiga': {
    name: 'Majiga (Buttermilk)',
    caloriesPerServing: 50,
    servingDescription: '1 glass buttermilk (200ml)',
    verified: true,
    source: 'ICMR-NIN Food Composition Tables',
  },
};

/**
 * Common regional aliases and transliterations mapped to canonical database dishes.
 */
export const REGIONAL_DISH_ALIASES: Record<string, string> = {
  // Telugu & Andhra aliases
  'kodi kura': 'andhra chicken curry (kodi kura)',
  'andhra kodi kura': 'andhra chicken curry (kodi kura)',
  'kodi kura curry': 'andhra chicken curry (kodi kura)',
  'kodi vepudu': 'kodi vepudu',
  'andhra kodi vepudu': 'kodi vepudu',
  'chepala pulusu': 'chepala pulusu',
  'andhra chepala pulusu': 'chepala pulusu',
  'chepa pulusu': 'chepala pulusu',
  'chepa vepudu': 'chepala pulusu',
  'mamsam kura': 'mamsam kura',
  'andhra mamsam kura': 'mamsam kura',
  'mutton kura': 'mamsam kura',
  'gongura mamsam': 'gongura mamsam',
  'gongura mutton': 'gongura mamsam',
  'gongura chicken': 'gongura chicken',
  'gongura kodi kura': 'gongura chicken',
  'gongura pappu': 'gongura pappu',
  'palakura pappu': 'palakura pappu',
  'dosakaya pappu': 'dosakaya pappu',
  'tomato pappu': 'andhra tomato pappu',
  'pappu charu': 'pappu charu',
  'andhra pappu charu': 'pappu charu',
  'charu': 'aromatic tomato rasam',
  'miriyala charu': 'aromatic tomato rasam',
  'saaru': 'aromatic tomato rasam',
  'majjiga pulusu': 'majjiga pulusu',
  'majiga pulusu': 'majiga pulusu',
  'mor kuzhambu': 'majjiga pulusu',
  'gutti vankaya': 'gutti vankaya kura',
  'gutti vankaya kura': 'gutti vankaya kura',
  'vankaya kura': 'vankaya kura',
  'vankaya curry': 'vankaya kura',
  'bendakaya vepudu': 'bendakaya vepudu',
  'bendakaya fry': 'bendakaya vepudu',
  'dondakaya vepudu': 'dondakaya vepudu',
  'dondakaya fry': 'dondakaya vepudu',
  'aloo vepudu': 'aloo vepudu',
  'aloo fry': 'aloo vepudu',
  'alasanda vada': 'alasanda vada',
  'alasanda vadalu': 'alasanda vada',
  'bobbatlu': 'bobbatlu',
  'bakshalu': 'bakshalu',
  'polelu': 'puran poli',
  'puran poli': 'puran poli',
  'ariselu': 'ariselu',
  'athirasam': 'ariselu',
  'poornam boorelu': 'poornam boorelu',
  'boorelu': 'boorelu',
  'sunnundalu': 'sunnundalu',
  'paramannam': 'paramannam',
  'bellam paramannam': 'paramannam',
  'ragi sankati': 'ragi sankati',
  'ragi sangati': 'ragi sangati',
  'ragi mudde': 'ragi mudde',
  'royyala vepudu': 'royyala vepudu',
  'royyala kura': 'royyala vepudu',
  'prawns fry': 'royyala vepudu',
  'kodi guddu kura': 'kodi guddu kura',
  'guddu kura': 'kodi guddu kura',
  'guddu vepudu': 'egg bhurji',
  'kodi guddu vepudu': 'egg bhurji',
  'mirchi bajji': 'mirchi bajji',
  'chilli bajji': 'mirchi bajji',
  'daddojanam': 'daddojanam',
  'thayir sadam': 'curd rice',
  'kobbari annam': 'kobbari annam',
  'kobbari pachadi': 'kobbari pachadi',
  'kobbari chutney': 'kobbari pachadi',
  'allam pachadi': 'allam pachadi',
  'tomato pachadi': 'tomato pachadi',
  'gongura pachadi': 'gongura pachadi',
  'garelu': 'crispy medu vada',
  'minapa garelu': 'crispy medu vada',
  'chitti garelu': 'chitti garelu',
  'attu': 'plain dosa',
  'minapa attu': 'plain dosa',
  'pesara dosa': 'pesarattu',
  'pesarettu': 'pesarattu',
  'upma pesarattu': 'andhra pesarattu with upma',
  'mla pesarattu': 'andhra pesarattu with upma',
  'nimmakaya annam': 'tangy lemon rice (chitranna)',
  'chitranna': 'tangy lemon rice (chitranna)',
  'mamidikaya annam': 'mango rice',
  'pulihora': 'traditional andhra pulihora',
  'puliyodharai': 'traditional andhra pulihora',
  'punukulu': 'crispy andhra punugulu',
  'andhra punugulu': 'crispy andhra punugulu',
  'majjiga': 'buttermilk',
  'majiga': 'buttermilk',
  'chaas': 'buttermilk',
  'poha': 'poha',
  'kanda poha': 'poha',
  'batata poha': 'poha',
  'atukulu': 'poha',
  'upma': 'classic rava upma',
  'rava upma': 'classic rava upma',
  'uppittu': 'classic rava upma',
  'idly': 'idli',
  'idlee': 'idli',
  'idli sambar': 'steamed idli with sambar & chutney',
  'idly sambar': 'steamed idli with sambar & chutney',
  'wada and chatni': 'wada and chatni',
  'vada and chutney': 'wada and chatni',
  'wada and chutney': 'wada and chatni',
  'vada chatni': 'wada and chatni',
  'wada chatni': 'wada and chatni',
  'medu wada': 'crispy medu vada',
  'medu vada': 'crispy medu vada',
  'wada': 'crispy medu vada',
  'poori': 'poori bhaji',
  'puri': 'poori bhaji',
  'poori bhaji': 'poori bhaji',
  'puri bhaji': 'poori bhaji',
  'poori masala': 'poori masala',
  'puri kura': 'poori masala',
  'chapati': 'chapati',
  'chapathi': 'chapati',
  'chappathi': 'chapati',
  'roti': 'roti',
  'phulka': 'roti',
  'butter chicken': 'butter chicken',
  'murgh makhani': 'butter chicken',
  'chicken tikka masala': 'chicken tikka masala',
  'dal makhani': 'dal makhani',
  'dal tadka': 'comfort dal tadka',
  'yellow dal': 'comfort dal tadka',
  'paneer butter': 'paneer butter masala',
  'butter paneer': 'paneer butter masala',
  'shahi paneer': 'shahi paneer',
  'kadai paneer': 'kadai paneer',
  'matar paneer': 'matar paneer',
  'palak paneer': 'dhaba style palak paneer',
  'chole bhature': 'amritsari chole bhature',
  'chana masala': 'chole masala',
  'chole': 'chole masala',
  'rajma chawal': 'rajma chawal',
  'rajma': 'rajma masala',
  'khichdi': 'khichdi',
  'pongal': 'ven pongal',
  'ven pongal': 'ven pongal',
  'veg biryani': 'veg biryani',
  'chicken biryani': 'chicken biryani',
  'mutton biryani': 'mutton biryani',
  'egg biryani': 'egg biryani',
  'fried rice': 'restaurant style veg fried rice',
  'veg fried rice': 'restaurant style veg fried rice',
  'egg fried rice': 'egg fried rice',
  'chicken fried rice': 'chicken fried rice',
  'hakka noodles': 'veg hakka noodles',
  'veg noodles': 'veg hakka noodles',
  'gobi manchurian': 'gobi manchurian',
  'chilli chicken': 'chilli chicken',
  'chilli paneer': 'chilli paneer',
  'pizza': 'classic margherita pizza',
  'pasta': 'creamy penne alfredo pasta',
  'chai': 'masala chai',
  'tea': 'masala chai',
  'filter coffee': 'filter coffee',
  'coffee': 'filter coffee',
  'lassi': 'sweet lassi',
  'sweet lassi': 'sweet lassi',
  'samosa': 'samosa',
  'pav bhaji': 'pav bhaji',
  'vada pav': 'vada pav',
  'dhokla': 'dhokla',
};

const NUTRITION_CACHE_PREFIX = 'kept_nutrition_cache_';
const memoryNutritionCache = new Map<string, NutritionItem>();

/**
 * Retrieves cached verified nutrition data from memory or localStorage.
 */
export function getCachedDishNutrition(dishName: string): NutritionItem | undefined {
  if (!dishName || !dishName.trim()) return undefined;
  const key = normalizeString(dishName);
  if (memoryNutritionCache.has(key)) {
    return memoryNutritionCache.get(key);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = localStorage.getItem(`${NUTRITION_CACHE_PREFIX}${key}`);
      if (raw) {
        const item = JSON.parse(raw) as NutritionItem;
        memoryNutritionCache.set(key, item);
        return item;
      }
    } catch {
      // ignore localStorage errors
    }
  }
  return undefined;
}

/**
 * Persists verified nutrition data into memory and localStorage.
 */
export function setCachedDishNutrition(dishName: string, item: NutritionItem): void {
  if (!dishName || !item) return;
  const key = normalizeString(dishName);
  memoryNutritionCache.set(key, item);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(`${NUTRITION_CACHE_PREFIX}${key}`, JSON.stringify(item));
    } catch {
      // ignore localStorage quota
    }
  }
}

/**
 * Normalizes title string for dictionary matching and transliteration handling.
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  const splitAlpha = str.replace(/([a-zA-Z]+)(\d+)/g, '$1 $2').replace(/(\d+)([a-zA-Z]+)/g, '$1 $2');
  const clean = splitAlpha
    .toLowerCase()
    .replace(/[^\w\s&+,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return clean
    .replace(/\bchatni\b/g, 'chutney')
    .replace(/\bchutni\b/g, 'chutney')
    .replace(/\bwada\b/g, 'vada')
    .replace(/\bvadai\b/g, 'vada')
    .replace(/\bvadae\b/g, 'vada')
    .replace(/\bdosae\b/g, 'dosa')
    .replace(/\bdosai\b/g, 'dosa')
    .replace(/\bdhosa\b/g, 'dosa')
    .replace(/\bpanner\b/g, 'paneer')
    .replace(/\bpanir\b/g, 'paneer')
    .replace(/\bbiryanii\b/g, 'biryani')
    .replace(/\bbiriyani\b/g, 'biryani')
    .replace(/\bbriyani\b/g, 'biryani')
    .replace(/\bchapathi\b/g, 'chapati')
    .replace(/\bchappathi\b/g, 'chapati')
    .replace(/\bparota\b/g, 'paratha')
    .replace(/\bporotta\b/g, 'paratha')
    .replace(/\bpulav\b/g, 'pulao')
    .replace(/\bchiken\b/g, 'chicken')
    .replace(/\bidly\b/g, 'idli')
    .replace(/\bidlee\b/g, 'idli')
    .replace(/\bgulabjamun\b/g, 'gulab jamun')
    .replace(/\bpulihara\b/g, 'pulihora')
    .replace(/\bpunukulu\b/g, 'punugulu')
    .replace(/\buthappam\b/g, 'uttapam')
    .replace(/\bkichadi\b/g, 'khichdi')
    .replace(/\bkhichuri\b/g, 'khichdi')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes serving size value safely.
 * Returns default 1 for missing/invalid numbers.
 */
export function normalizeServingSize(servings?: number | null): number {
  if (servings === undefined || servings === null || typeof servings !== 'number' || isNaN(servings)) {
    return 1;
  }
  if (servings <= 0) return 1;
  // Limit max servings to 24 to guard against erratic values
  if (servings > 24) return 24;
  // Round to nearest 0.5 or 1 decimal place
  return Math.round(servings * 2) / 2;
}

/**
 * Direct lookup for a single dish or food item.
 * Searches verified database, regional aliases, cached items, and reliable fuzzy matching.
 */
export function lookupDishNutrition(dishName: string, allowFuzzy = true): NutritionItem | undefined {
  if (!dishName || !dishName.trim()) return undefined;
  const normalized = normalizeString(dishName);

  // 1. Direct exact match in verified database
  if (VERIFIED_NUTRITION_DATABASE[normalized]) {
    return VERIFIED_NUTRITION_DATABASE[normalized];
  }

  // 2. Exact match in regional aliases
  if (REGIONAL_DISH_ALIASES[normalized] && VERIFIED_NUTRITION_DATABASE[REGIONAL_DISH_ALIASES[normalized]]) {
    return VERIFIED_NUTRITION_DATABASE[REGIONAL_DISH_ALIASES[normalized]];
  }

  // 3. Check persistent cache
  const cached = getCachedDishNutrition(normalized);
  if (cached) {
    return cached;
  }

  // 4. Case-insensitive dictionary entry iteration
  for (const [key, item] of Object.entries(VERIFIED_NUTRITION_DATABASE)) {
    if (normalized === key) return item;
  }

  if (!allowFuzzy) return undefined;

  // 5. Delimiter check: Do not fuzzy-match multi-item dishes as a single unit
  const hasDelimiter = /\b(?:&|and|\+|with)\b|,/i.test(dishName);
  if (hasDelimiter) {
    return undefined;
  }

  // 6. Regional alias substring containment
  for (const [alias, canonicalKey] of Object.entries(REGIONAL_DISH_ALIASES)) {
    if (normalized === alias || normalized.includes(alias)) {
      if (VERIFIED_NUTRITION_DATABASE[canonicalKey]) {
        return VERIFIED_NUTRITION_DATABASE[canonicalKey];
      }
    }
  }

  // 7. Core dish patterns
  if (normalized.includes('masala dosa')) {
    return VERIFIED_NUTRITION_DATABASE['crispy masala dosa'];
  }
  if (normalized.includes('idli') && (normalized.includes('chutney') || normalized.includes('sambar'))) {
    return VERIFIED_NUTRITION_DATABASE['steamed idli with sambar & chutney'];
  }
  if (normalized.includes('medu vada') || normalized.includes('wada') || normalized.includes('garelu')) {
    return VERIFIED_NUTRITION_DATABASE['crispy medu vada'];
  }
  if (normalized.includes('paneer butter') || normalized.includes('butter paneer')) {
    return VERIFIED_NUTRITION_DATABASE['paneer butter masala'];
  }
  if (normalized.includes('dal tadka') || normalized.includes('yellow dal')) {
    return VERIFIED_NUTRITION_DATABASE['comfort dal tadka'];
  }
  if (normalized.includes('dal rice') || (normalized.includes('dal') && normalized.includes('rice'))) {
    return VERIFIED_NUTRITION_DATABASE['dal rice'];
  }
  if (normalized.includes('biryani')) {
    if (normalized.includes('chicken')) return VERIFIED_NUTRITION_DATABASE['chicken biryani'];
    if (normalized.includes('mutton')) return VERIFIED_NUTRITION_DATABASE['mutton biryani'];
    if (normalized.includes('egg')) return VERIFIED_NUTRITION_DATABASE['egg biryani'];
    return VERIFIED_NUTRITION_DATABASE['hyderabadi dum biryani'];
  }
  if (normalized.includes('lemon rice') || normalized.includes('chitranna')) {
    return VERIFIED_NUTRITION_DATABASE['tangy lemon rice (chitranna)'];
  }
  if (normalized.includes('fried rice')) {
    if (normalized.includes('egg')) return VERIFIED_NUTRITION_DATABASE['egg fried rice'];
    if (normalized.includes('chicken')) return VERIFIED_NUTRITION_DATABASE['chicken fried rice'];
    if (normalized.includes('mushroom')) return VERIFIED_NUTRITION_DATABASE['mushroom fried rice'];
    return VERIFIED_NUTRITION_DATABASE['restaurant style veg fried rice'];
  }
  if (normalized.includes('chicken curry') || normalized.includes('kodi kura')) {
    return VERIFIED_NUTRITION_DATABASE['andhra chicken curry (kodi kura)'];
  }
  if (normalized.includes('chole bhature')) {
    return VERIFIED_NUTRITION_DATABASE['amritsari chole bhature'];
  }
  if (normalized.includes('palak paneer')) {
    return VERIFIED_NUTRITION_DATABASE['dhaba style palak paneer'];
  }
  if (normalized.includes('tomato pappu')) {
    return VERIFIED_NUTRITION_DATABASE['andhra tomato pappu'];
  }
  if (normalized.includes('pulihora')) {
    return VERIFIED_NUTRITION_DATABASE['traditional andhra pulihora'];
  }
  if (normalized.includes('poori bhaji') || normalized.includes('puri bhaji') || normalized.includes('poori masala')) {
    return VERIFIED_NUTRITION_DATABASE['poori bhaji'];
  }
  if (normalized.includes('aloo paratha')) {
    return VERIFIED_NUTRITION_DATABASE['aloo paratha'];
  }
  if (normalized.includes('pav bhaji')) {
    return VERIFIED_NUTRITION_DATABASE['pav bhaji'];
  }
  if (normalized.includes('vada pav')) {
    return VERIFIED_NUTRITION_DATABASE['vada pav'];
  }
  if (normalized.includes('curd rice') || normalized.includes('daddojanam')) {
    return VERIFIED_NUTRITION_DATABASE['daddojanam'];
  }
  if (normalized.includes('chepala pulusu') || (normalized.includes('fish') && normalized.includes('curry'))) {
    return VERIFIED_NUTRITION_DATABASE['chepala pulusu'];
  }

  return undefined;
}

/**
 * Returns candidate dishes for nutrition auto-complete and suggestions in UI.
 */
export function findNutritionCandidates(query: string, maxResults = 4): NutritionItem[] {
  if (!query || query.trim().length < 2) return [];
  const normalized = normalizeString(query);
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);
  const results: { item: NutritionItem; score: number }[] = [];
  const seenNames = new Set<string>();

  // Check verified database
  for (const [key, item] of Object.entries(VERIFIED_NUTRITION_DATABASE)) {
    if (seenNames.has(item.name.toLowerCase())) continue;
    let score = 0;
    const itemKeyNorm = normalizeString(key);
    const itemNameNorm = normalizeString(item.name);

    if (itemKeyNorm === normalized || itemNameNorm === normalized) {
      score = 100;
    } else if (itemKeyNorm.startsWith(normalized) || itemNameNorm.startsWith(normalized)) {
      score = 80;
    } else if (itemKeyNorm.includes(normalized) || itemNameNorm.includes(normalized)) {
      score = 60;
    } else {
      const matchedWords = words.filter((w) => itemKeyNorm.includes(w) || itemNameNorm.includes(w));
      if (matchedWords.length > 0) {
        score = 25 * matchedWords.length;
      }
    }

    if (score > 0) {
      seenNames.add(item.name.toLowerCase());
      results.push({ item, score });
    }
  }

  // Also check regional aliases
  for (const [alias, canonicalKey] of Object.entries(REGIONAL_DISH_ALIASES)) {
    const item = VERIFIED_NUTRITION_DATABASE[canonicalKey];
    if (item && !seenNames.has(item.name.toLowerCase())) {
      const aliasNorm = normalizeString(alias);
      let score = 0;
      if (aliasNorm === normalized) {
        score = 95;
      } else if (aliasNorm.startsWith(normalized) || aliasNorm.includes(normalized)) {
        score = 65;
      }
      if (score > 0) {
        seenNames.add(item.name.toLowerCase());
        results.push({ item, score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults).map((r) => r.item);
}

/**
 * Asynchronously searches for reliable nutritional information for a meal name.
 * Checks local verified database, aliases, persistent cache, and falls back to Open Food Facts free public API.
 */
export async function resolveMealNutritionAsync(dishName: string): Promise<NutritionItem | undefined> {
  if (!dishName || !dishName.trim()) return undefined;

  // 1. Instant local match
  const localMatch = lookupDishNutrition(dishName);
  if (localMatch) {
    return localMatch;
  }

  // 2. Check persistent cache
  const cached = getCachedDishNutrition(dishName);
  if (cached) {
    return cached;
  }

  // 3. Fallback to Open Food Facts free public API (permitted, no billing/trial required)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return undefined;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200);
    const cleanQuery = dishName.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(cleanQuery)}&search_simple=1&action=process&json=1&page_size=3`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.products) && data.products.length > 0) {
        for (const prod of data.products) {
          const nutriments = prod.nutriments;
          const energyKcal =
            nutriments?.['energy-kcal_100g'] ??
            nutriments?.['energy-kcal_serving'] ??
            nutriments?.['energy-kcal'];

          if (typeof energyKcal === 'number' && energyKcal > 15 && energyKcal < 1000) {
            const prodName = (prod.product_name || prod.product_name_en || dishName).trim();
            const calPerServing = Math.round(energyKcal);
            const foundItem: NutritionItem = {
              name: prodName,
              caloriesPerServing: calPerServing,
              servingDescription: prod.serving_size || '1 standard portion (~150g)',
              verified: true,
              source: 'Open Food Facts Public Database',
            };
            setCachedDishNutrition(dishName, foundItem);
            return foundItem;
          }
        }
      }
    }
  } catch {
    // Offline or network timeout handled silently
  }

  return undefined;
}

/**
 * Splits a meal title into distinct sub-items if it contains conjunctions,
 * preventing double-counting if the composite dish is already a known unit.
 */
function parseCompositeMeal(title: string): { isComposite: boolean; items: string[] } {
  const normalized = normalizeString(title);

  // If the complete title is already an exact known composite dish, DO NOT split!
  if (lookupDishNutrition(normalized, false)) {
    return { isComposite: false, items: [title.trim()] };
  }

  // Split on delimiters: " & ", " and ", " + ", " with ", ","
  const parts = title
    .split(/\s+(?:&|and|\+|with)\s+|,/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length <= 1) {
    return { isComposite: false, items: [title.trim()] };
  }

  // Deduplicate case-insensitively to prevent double-counting
  const uniqueItems: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const pNorm = normalizeString(part);
    if (!seen.has(pNorm)) {
      seen.add(pNorm);
      uniqueItems.push(part);
    }
  }

  return { isComposite: true, items: uniqueItems };
}

/**
 * Single reliable calculation utility to calculate meal calories accurately.
 * Normalizes serving sizes and handles explicit calories, single items, multi-items, and missing nutrition data safely.
 */
export function calculateMealCalories(
  meal: Meal | undefined,
  recipes: Recipe[] = []
): CalorieCalculationResult {
  if (!meal || !meal.title) {
    return {
      calories: null,
      isEstimate: false,
      servingSize: 1,
      baseCalories: null,
      source: 'unavailable',
    };
  }

  const servingSize = normalizeServingSize(meal.servings);
  const rawTitle = meal.title.trim();

  // 0. Priority: If meal has explicit verified or manually entered calories_per_serving stored on the record
  if (typeof meal.calories_per_serving === 'number' && meal.calories_per_serving > 0) {
    const base = Math.round(meal.calories_per_serving);
    const catalogItem = lookupDishNutrition(rawTitle, true);
    const isManual = !catalogItem || Math.abs(catalogItem.caloriesPerServing - base) > 0;
    return {
      calories: Math.round(base * servingSize),
      isEstimate: !isManual,
      servingSize,
      baseCalories: base,
      source: isManual ? 'manual' : 'verified_catalog',
      details: `${rawTitle} (${base} kcal/serving)`,
      matchedDishName: rawTitle,
    };
  }

  // 1. Check if meal references a saved Recipe with explicit nutritional data
  if (meal.recipe_id && recipes.length > 0) {
    const matchedRecipe = recipes.find((r) => r.id === meal.recipe_id);
    if (matchedRecipe) {
      if (typeof matchedRecipe.calories_per_serving === 'number' && matchedRecipe.calories_per_serving > 0) {
        const base = matchedRecipe.calories_per_serving;
        return {
          calories: Math.round(base * servingSize),
          isEstimate: true,
          servingSize,
          baseCalories: base,
          source: 'recipe',
          details: `Recipe: ${matchedRecipe.title} (${base} kcal/serving)`,
          matchedDishName: matchedRecipe.title,
        };
      }
      // If recipe has no explicit calories_per_serving, check database by recipe title
      const recipeNutrition = lookupDishNutrition(matchedRecipe.title);
      if (recipeNutrition) {
        const base = recipeNutrition.caloriesPerServing;
        return {
          calories: Math.round(base * servingSize),
          isEstimate: true,
          servingSize,
          baseCalories: base,
          source: 'recipe',
          details: `${recipeNutrition.servingDescription} (${recipeNutrition.source})`,
          matchedDishName: recipeNutrition.name,
        };
      }
    }
  }

  // 2. Multi-item meal parsing without double-counting (checked before single fuzzy matching)
  const parsed = parseCompositeMeal(rawTitle);
  if (parsed.isComposite && parsed.items.length > 1) {
    let combinedBase = 0;
    let allRecognized = true;
    const subItems: { name: string; calories: number | null; isEstimate: boolean }[] = [];

    for (const subItem of parsed.items) {
      const match = lookupDishNutrition(subItem);
      if (match) {
        combinedBase += match.caloriesPerServing;
        subItems.push({
          name: match.name,
          calories: match.caloriesPerServing,
          isEstimate: true,
        });
      } else {
        // One of the composite items has no verified nutrition
        allRecognized = false;
        subItems.push({
          name: subItem,
          calories: null,
          isEstimate: false,
        });
      }
    }

    if (allRecognized && combinedBase > 0) {
      return {
        calories: Math.round(combinedBase * servingSize),
        isEstimate: true,
        servingSize,
        baseCalories: combinedBase,
        source: 'multi_item',
        details: `Combined from: ${subItems.map((s) => `${s.name} (${s.calories} kcal)`).join(' + ')}`,
        subItems,
      };
    } else {
      // If multi-item has an unverified component, do not guess
      return {
        calories: null,
        isEstimate: false,
        servingSize,
        baseCalories: null,
        source: 'unavailable',
        details: 'Calories unavailable',
      };
    }
  }

  // 3. Check title against verified nutrition database & regional aliases
  const singleDishMatch = lookupDishNutrition(rawTitle);
  if (singleDishMatch) {
    const base = singleDishMatch.caloriesPerServing;
    return {
      calories: Math.round(base * servingSize),
      isEstimate: true,
      servingSize,
      baseCalories: base,
      source: 'verified_catalog',
      details: `${singleDishMatch.servingDescription} (${singleDishMatch.source})`,
      matchedDishName: singleDishMatch.name,
    };
  }

  // 4. Unknown meal: Reliable data is unavailable.
  // Never invent arbitrary calories. Return null to clearly trigger "Calories unavailable".
  return {
    calories: null,
    isEstimate: false,
    servingSize,
    baseCalories: null,
    source: 'unavailable',
    details: 'Calories unavailable',
  };
}

/**
 * Calculates category totals (Breakfast Total, Lunch Total, Dinner Total).
 */
export function calculateCategoryCalories(
  meals: (Meal | undefined)[],
  recipes: Recipe[] = []
): CategoryCalorieTotal {
  // Filter out undefined/null meal slots
  const validMeals = meals.filter((m): m is Meal => Boolean(m && m.title));

  if (validMeals.length === 0) {
    return {
      totalCalories: 0,
      hasUnavailable: false,
      unavailableCount: 0,
      mealCount: 0,
      isComplete: true,
      formattedText: '—',
      compactText: '—',
    };
  }

  let total = 0;
  let unavailableCount = 0;

  for (const meal of validMeals) {
    const result = calculateMealCalories(meal, recipes);
    if (result.calories !== null && result.calories >= 0) {
      total += result.calories;
    } else {
      unavailableCount += 1;
    }
  }

  const hasUnavailable = unavailableCount > 0;
  const isComplete = !hasUnavailable;

  let formattedText: string;
  let compactText: string;

  if (isComplete) {
    formattedText = `${total.toLocaleString()} kcal`;
    compactText = `${total.toLocaleString()} kcal`;
  } else if (total > 0) {
    formattedText = `${total.toLocaleString()}+ kcal (Incomplete)`;
    compactText = `${total.toLocaleString()}+ kcal*`;
  } else {
    formattedText = 'Calories unavailable';
    compactText = 'N/A';
  }

  return {
    totalCalories: total,
    hasUnavailable,
    unavailableCount,
    mealCount: validMeals.length,
    isComplete,
    formattedText,
    compactText,
  };
}

/**
 * Calculates Total Daily Calories = Breakfast Total + Lunch Total + Dinner Total.
 * Clearly flags incomplete days if any planned meal has unavailable data.
 */
export function calculateDailyCalories(
  breakfastMeals: (Meal | undefined)[],
  lunchMeals: (Meal | undefined)[],
  dinnerMeals: (Meal | undefined)[],
  recipes: Recipe[] = []
): DailyCalorieTotal {
  const breakfast = calculateCategoryCalories(breakfastMeals, recipes);
  const lunch = calculateCategoryCalories(lunchMeals, recipes);
  const dinner = calculateCategoryCalories(dinnerMeals, recipes);

  const totalMealCount = breakfast.mealCount + lunch.mealCount + dinner.mealCount;
  const totalCalories = breakfast.totalCalories + lunch.totalCalories + dinner.totalCalories;
  const unavailableCount = breakfast.unavailableCount + lunch.unavailableCount + dinner.unavailableCount;
  const hasUnavailable = unavailableCount > 0;
  const isComplete = totalMealCount > 0 && !hasUnavailable;

  let formattedText: string;
  let compactText: string;

  if (totalMealCount === 0) {
    formattedText = 'No meals planned';
    compactText = 'No meals';
  } else if (isComplete) {
    formattedText = `${totalCalories.toLocaleString()} kcal`;
    compactText = `${totalCalories.toLocaleString()} kcal`;
  } else if (totalCalories > 0) {
    formattedText = `${totalCalories.toLocaleString()}+ kcal (Incomplete)`;
    compactText = `${totalCalories.toLocaleString()}+ kcal*`;
  } else {
    formattedText = 'Calories unavailable';
    compactText = 'N/A';
  }

  return {
    breakfast,
    lunch,
    dinner,
    totalCalories,
    hasUnavailable,
    unavailableCount,
    totalMealCount,
    isComplete,
    formattedText,
    compactText,
  };
}

/**
 * Calculates Total Weekly Calories from all 7 daily calorie totals.
 * Sums all seven daily totals without double-counting meals.
 * If any meal in any day has unavailable nutrition, clearly indicates that the weekly total is incomplete.
 */
export function calculateWeeklyCalories(
  dailyTotals: DailyCalorieTotal[]
): WeeklyCalorieTotal {
  let totalCalories = 0;
  let unavailableCount = 0;
  let totalMealCount = 0;
  let plannedDaysCount = 0;
  let breakfastTotalCalories = 0;
  let lunchTotalCalories = 0;
  let dinnerTotalCalories = 0;

  for (const day of dailyTotals) {
    totalCalories += day.totalCalories;
    unavailableCount += day.unavailableCount;
    totalMealCount += day.totalMealCount;
    if (day.totalMealCount > 0) {
      plannedDaysCount += 1;
    }
    breakfastTotalCalories += day.breakfast.totalCalories;
    lunchTotalCalories += day.lunch.totalCalories;
    dinnerTotalCalories += day.dinner.totalCalories;
  }

  const hasUnavailable = unavailableCount > 0;
  const isComplete = totalMealCount > 0 && !hasUnavailable;

  let formattedText: string;
  let compactText: string;

  if (totalMealCount === 0) {
    formattedText = 'No meals planned';
    compactText = 'No meals';
  } else if (isComplete) {
    formattedText = `${totalCalories.toLocaleString()} kcal`;
    compactText = `${totalCalories.toLocaleString()} kcal`;
  } else if (totalCalories > 0) {
    formattedText = `${totalCalories.toLocaleString()}+ kcal (Incomplete)`;
    compactText = `${totalCalories.toLocaleString()}+ kcal*`;
  } else {
    formattedText = 'Calories unavailable';
    compactText = 'N/A';
  }

  const averageDailyCalories =
    plannedDaysCount > 0 && totalCalories > 0
      ? Math.round(totalCalories / plannedDaysCount)
      : null;

  return {
    totalCalories,
    hasUnavailable,
    unavailableCount,
    totalMealCount,
    plannedDaysCount,
    isComplete,
    formattedText,
    compactText,
    averageDailyCalories,
    breakfastTotalCalories,
    lunchTotalCalories,
    dinnerTotalCalories,
  };
}
