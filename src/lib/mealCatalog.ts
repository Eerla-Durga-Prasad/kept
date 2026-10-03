import { Recipe } from '../sync/types';
import { getCachedMealImage, SAFE_FALLBACK_FOOD_IMAGE } from './foodImageResolver';

export interface MealRecipeOption {
  id: string;
  name: string;
  image: string;
  category: string;
  preparationTime: string;
  recipeId?: string;
}

export const MEAL_CATALOG: MealRecipeOption[] = [
  // Breakfasts
  {
    id: 'meal_oats_fruits',
    name: 'Oats & Fruits',
    image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '10 mins',
  },
  {
    id: 'meal_idli_chutney',
    name: 'Idli & Chutney',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '20 mins',
  },
  {
    id: 'meal_poha',
    name: 'Poha',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '15 mins',
  },
  {
    id: 'meal_dosa',
    name: 'Dosa',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '20 mins',
    recipeId: 'rec_masala_dosa',
  },
  {
    id: 'meal_upma',
    name: 'Upma',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '15 mins',
  },
  {
    id: 'meal_pancakes',
    name: 'Pancakes',
    image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '20 mins',
  },
  {
    id: 'meal_smoothie_bowl',
    name: 'Smoothie Bowl',
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
    category: 'Breakfast',
    preparationTime: '10 mins',
  },

  // Lunches
  {
    id: 'meal_lemon_rice',
    name: 'Lemon Rice',
    image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80',
    category: 'Rice Dishes',
    preparationTime: '20 mins',
  },
  {
    id: 'meal_veg_biryani',
    name: 'Veg Biryani',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
    category: 'Rice Dishes',
    preparationTime: '50 mins',
    recipeId: 'rec_veg_biryani',
  },
  {
    id: 'meal_roti_curry',
    name: 'Roti & Curry',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    category: 'Comfort',
    preparationTime: '30 mins',
  },
  {
    id: 'meal_pasta',
    name: 'Pasta',
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=600&q=80',
    category: 'Comfort',
    preparationTime: '25 mins',
  },
  {
    id: 'meal_curd_rice',
    name: 'Curd Rice',
    image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80',
    category: 'Comfort',
    preparationTime: '15 mins',
  },
  {
    id: 'meal_pulao',
    name: 'Pulao',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
    category: 'Rice Dishes',
    preparationTime: '30 mins',
  },

  // Dinners
  {
    id: 'meal_paneer_curry',
    name: 'Paneer Curry',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
    category: 'Curries',
    preparationTime: '30 mins',
  },
  {
    id: 'meal_dal_rice',
    name: 'Dal Rice',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
    category: 'Comfort',
    preparationTime: '25 mins',
    recipeId: 'rec_dal_tadka',
  },
  {
    id: 'meal_chicken_curry',
    name: 'Chicken Curry',
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
    category: 'Curries',
    preparationTime: '40 mins',
  },
  {
    id: 'meal_fried_rice',
    name: 'Fried Rice',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
    category: 'Rice Dishes',
    preparationTime: '20 mins',
  },
  {
    id: 'meal_chapati',
    name: 'Chapati',
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    category: 'Comfort',
    preparationTime: '25 mins',
  },
  {
    id: 'meal_veg_soup',
    name: 'Veg Soup',
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
    category: 'Comfort',
    preparationTime: '20 mins',
  },
  {
    id: 'meal_paneer_butter_masala',
    name: 'Paneer Butter Masala',
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
    category: 'Curries',
    preparationTime: '30 mins',
    recipeId: 'rec_paneer_butter_masala',
  },
];

/**
 * Single source of truth lookup for meal definition.
 * Finds the canonical meal recipe option by recipe_id, id, or name.
 */
export function getMealDefinition(
  identifier: { recipe_id?: string; title?: string; id?: string; image_url?: string } | string | undefined,
  recipes?: Recipe[]
): MealRecipeOption | undefined {
  if (!identifier) return undefined;

  // 1. String lookup: matches ID, recipeId, or dish name
  if (typeof identifier === 'string') {
    const rawKey = identifier.trim();
    const normalized = rawKey.toLowerCase();

    if (recipes) {
      const matchedRecipe = recipes.find(
        (r) => r.id === rawKey || r.title.toLowerCase().trim() === normalized
      );
      if (matchedRecipe) {
        return {
          id: matchedRecipe.id,
          name: matchedRecipe.title,
          image: matchedRecipe.image_url,
          category: matchedRecipe.category,
          preparationTime: matchedRecipe.prep_time,
          recipeId: matchedRecipe.id,
        };
      }
    }

    const byId = MEAL_CATALOG.find((m) => m.id === rawKey || m.recipeId === rawKey);
    if (byId) return byId;

    const byName = MEAL_CATALOG.find((m) => {
      const mNorm = m.name.toLowerCase().trim();
      if (mNorm === normalized) return true;
      if (normalized === 'dosa' && mNorm.includes('dosa')) return true;
      if (normalized === 'crispy masala dosa' && mNorm === 'dosa') return true;
      if (normalized === 'chapati & sabzi' && mNorm === 'chapati') return true;
      if (normalized === 'hyderabadi dum biryani' && mNorm === 'veg biryani') return true;
      if (normalized === 'comfort dal tadka' && mNorm === 'dal rice') return true;
      return false;
    });
    if (byName) return byName;

    const cachedImage = getCachedMealImage(identifier);
    return {
      id: 'custom_' + identifier.toLowerCase().replace(/\s+/g, '_'),
      name: identifier,
      image: cachedImage || SAFE_FALLBACK_FOOD_IMAGE,
      category: 'Meal',
      preparationTime: '20 mins',
    };
  }

  // 2. Object lookup (Meal or Dish Selection)
  const title = (identifier.title || '').trim();
  const normalizedTitle = title.toLowerCase();

  // If title matches a DB recipe
  if (recipes && title) {
    const matched = recipes.find((r) => r.title.toLowerCase().trim() === normalizedTitle);
    if (matched) {
      return {
        id: matched.id,
        name: matched.title,
        image: identifier.image_url || matched.image_url,
        category: matched.category,
        preparationTime: matched.prep_time,
        recipeId: matched.id,
      };
    }
  }

  // If title matches a predefined catalog meal
  if (title) {
    const byName = MEAL_CATALOG.find((m) => {
      const mNorm = m.name.toLowerCase().trim();
      return (
        mNorm === normalizedTitle ||
        (normalizedTitle === 'dosa' && mNorm.includes('dosa')) ||
        (normalizedTitle === 'crispy masala dosa' && mNorm === 'dosa') ||
        (normalizedTitle === 'chapati & sabzi' && mNorm === 'chapati') ||
        (normalizedTitle === 'hyderabadi dum biryani' && mNorm === 'veg biryani') ||
        (normalizedTitle === 'comfort dal tadka' && mNorm === 'dal rice')
      );
    });
    if (byName) {
      return {
        ...byName,
        image: identifier.image_url || byName.image,
      };
    }
  }

  // Custom meal: title does not match catalog or recipes.
  // The selected meal's own image_url is always the single source of truth,
  // unless it contains the old generic fallback image for a non-dal meal and a specific image has been resolved.
  if (title) {
    const cachedImage = getCachedMealImage(title);
    const isOldGenericFallback =
      Boolean(identifier.image_url && identifier.image_url.includes('photo-1546833999-b9f581a1996d')) &&
      !normalizedTitle.includes('dal') &&
      !normalizedTitle.includes('tadka');

    const effectiveImage = isOldGenericFallback
      ? (cachedImage || identifier.image_url || SAFE_FALLBACK_FOOD_IMAGE)
      : (identifier.image_url || cachedImage || SAFE_FALLBACK_FOOD_IMAGE);

    return {
      id: identifier.recipe_id || identifier.id || 'custom',
      name: title,
      image: effectiveImage,
      category: 'Meal',
      preparationTime: '20 mins',
      recipeId: identifier.recipe_id,
    };
  }

  return undefined;
}
