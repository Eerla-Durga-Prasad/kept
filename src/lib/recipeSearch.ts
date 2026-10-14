import { Recipe, RecipeIngredient } from '../sync/types';
import { COMPREHENSIVE_RECIPES, ExtendedRecipe } from '../data/recipeCatalog';

export interface SearchResult {
  recipe: ExtendedRecipe;
  score: number;
  matchReason?: 'exact' | 'corrected' | 'title' | 'ingredient' | 'cuisine' | 'category' | 'tag' | 'external';
  matchedIngredient?: string;
}

export interface SearchResponse {
  results: ExtendedRecipe[];
  correctedTerm: string | null;
  totalCount: number;
  isExternalSearching: boolean;
}

const EXTERNAL_CACHE_KEY = 'kept_external_recipes_cache_v1';
const memoryExternalCache = new Map<string, ExtendedRecipe[]>();

// In-memory persistent external recipe cache
function getCachedExternalRecipes(query: string): ExtendedRecipe[] | null {
  const q = query.toLowerCase().trim();
  if (memoryExternalCache.has(q)) {
    return memoryExternalCache.get(q)!;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(`${EXTERNAL_CACHE_KEY}_${q}`);
      if (stored) {
        const parsed = JSON.parse(stored) as ExtendedRecipe[];
        memoryExternalCache.set(q, parsed);
        return parsed;
      }
    } catch {
      // Ignore storage errors
    }
  }
  return null;
}

function setCachedExternalRecipes(query: string, recipes: ExtendedRecipe[]): void {
  const q = query.toLowerCase().trim();
  memoryExternalCache.set(q, recipes);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(`${EXTERNAL_CACHE_KEY}_${q}`, JSON.stringify(recipes));
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Standard Levenshtein distance
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Common typo and phonetic normalization dictionary
 */
const TYPO_MAP: Record<string, string> = {
  masla: 'masala',
  massala: 'masala',
  biriyani: 'biryani',
  biryanii: 'biryani',
  briyani: 'biryani',
  chiken: 'chicken',
  chikken: 'chicken',
  idly: 'idli',
  idlies: 'idli',
  idlis: 'idli',
  panner: 'paneer',
  panir: 'paneer',
  wada: 'vada',
  vadai: 'vada',
  vadae: 'vada',
  dosai: 'dosa',
  dosae: 'dosa',
  dhosa: 'dosa',
  chatni: 'chutney',
  chutni: 'chutney',
  chapathi: 'chapati',
  chappati: 'chapati',
  parota: 'paratha',
  porotta: 'paratha',
  pulav: 'pulao',
  pilaf: 'pulao',
  manchuriyan: 'manchurian',
  manchuriya: 'manchurian',
  gulabjamun: 'gulab jamun',
  jamun: 'gulab jamun',
  pulihora: 'pulihora',
  pulihara: 'pulihora',
  puliyogare: 'pulihora',
  bonda: 'mysore bonda',
  mysor: 'mysore',
  uttapam: 'uttapam',
  uthappam: 'uttapam',
  pongal: 'pongal',
  pesarattu: 'pesarattu',
  pesara: 'pesarattu',
  sambar: 'sambar',
  rasam: 'rasam',
  charu: 'rasam',
  pizza: 'pizza',
  pizzas: 'pizza',
  pasta: 'pasta',
  pastas: 'pasta',
  chole: 'chole',
  rajma: 'rajma',
  naan: 'naan',
  roti: 'roti',
  phulka: 'roti',
};

/**
 * Normalize and auto-correct search query terms
 */
export function normalizeSearchQuery(raw: string): {
  original: string;
  normalized: string;
  corrected: string;
  hasCorrection: boolean;
  tokens: string[];
} {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return { original: '', normalized: '', corrected: '', hasCorrection: false, tokens: [] };
  }

  // Split alphanumeric boundaries
  const splitAlpha = trimmed
    .replace(/([a-zA-Z]+)(\d+)/g, '$1 $2')
    .replace(/(\d+)([a-zA-Z]+)/g, '$1 $2')
    .replace(/[-_+/&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = splitAlpha.split(/\s+/).filter(Boolean);
  let hasCorrection = false;

  const correctedWords = words.map((w) => {
    // Check direct dictionary replacement
    if (TYPO_MAP[w]) {
      if (TYPO_MAP[w] !== w) hasCorrection = true;
      return TYPO_MAP[w];
    }

    // Check fuzzy match against dictionary keys
    for (const [typo, fix] of Object.entries(TYPO_MAP)) {
      if (levenshtein(w, typo) <= 1 && w.length >= 4) {
        hasCorrection = true;
        return fix;
      }
    }

    // Singularize simple trailing 's' if > 4 chars (e.g., dosas -> dosa, samosas -> samosa)
    if (w.endsWith('s') && w.length > 4 && !w.endsWith('ss')) {
      const singular = w.slice(0, -1);
      if (TYPO_MAP[singular]) {
        hasCorrection = true;
        return TYPO_MAP[singular];
      }
    }

    return w;
  });

  const corrected = correctedWords.join(' ');
  return {
    original: raw,
    normalized: splitAlpha,
    corrected,
    hasCorrection: hasCorrection && corrected !== splitAlpha,
    tokens: correctedWords,
  };
}

/**
 * Score a single recipe against a query and its tokens
 */
function scoreRecipe(recipe: ExtendedRecipe, queryInfo: ReturnType<typeof normalizeSearchQuery>): SearchResult | null {
  const { normalized, corrected, tokens } = queryInfo;
  const titleLower = recipe.title.toLowerCase();
  const descLower = (recipe.description || '').toLowerCase();
  const catLower = (recipe.category || '').toLowerCase();
  const cuisineLower = (recipe.cuisine || '').toLowerCase();
  const tagsLower = (recipe.tags || []).map((t) => t.toLowerCase());

  let score = 0;
  let matchReason: SearchResult['matchReason'] = undefined;
  let matchedIngredient: string | undefined = undefined;

  // 1. Exact match on title (highest priority)
  if (titleLower === normalized || titleLower === corrected) {
    return { recipe, score: 100, matchReason: 'exact' };
  }

  // 2. Title contains full corrected query
  if (corrected && titleLower.includes(corrected)) {
    score = Math.max(score, 95);
    matchReason = matchReason || 'title';
  } else if (normalized && titleLower.includes(normalized)) {
    score = Math.max(score, 90);
    matchReason = matchReason || 'title';
  }

  // 3. Typo-tolerant title token check
  const titleWords = titleLower.split(/[^a-z0-9]+/).filter(Boolean);
  let matchedTokenCount = 0;

  for (const token of tokens) {
    let tokenMatched = false;

    // Direct token match in title
    if (titleWords.some((tw) => tw === token || tw.startsWith(token))) {
      tokenMatched = true;
    } else {
      // Fuzzy match in title tokens (distance <= 1 for 4-5 chars, <= 2 for 6+ chars)
      for (const tw of titleWords) {
        const maxDist = tw.length >= 6 ? 2 : tw.length >= 4 ? 1 : 0;
        if (levenshtein(tw, token) <= maxDist) {
          tokenMatched = true;
          break;
        }
      }
    }

    if (tokenMatched) {
      matchedTokenCount++;
    }
  }

  if (matchedTokenCount === tokens.length && tokens.length > 0) {
    score = Math.max(score, 85 + tokens.length * 2);
    matchReason = matchReason || 'corrected';
  } else if (matchedTokenCount > 0) {
    score = Math.max(score, 70 + (matchedTokenCount / tokens.length) * 15);
    matchReason = matchReason || 'title';
  }

  // 4. Tags & Aliases match
  for (const tag of tagsLower) {
    if (tag === normalized || tag === corrected) {
      score = Math.max(score, 88);
      matchReason = matchReason || 'tag';
      break;
    }
    if (tag.includes(corrected) || tag.includes(normalized)) {
      score = Math.max(score, 82);
      matchReason = matchReason || 'tag';
    }
  }

  // 5. Ingredient matching
  for (const ing of recipe.ingredients) {
    const ingLower = ing.name.toLowerCase();
    for (const token of tokens) {
      if (ingLower.includes(token)) {
        score = Math.max(score, 68);
        matchReason = matchReason || 'ingredient';
        matchedIngredient = ing.name;
        break;
      }
    }
  }

  // 6. Cuisine & Category matching
  if (cuisineLower.includes(corrected) || cuisineLower.includes(normalized)) {
    score = Math.max(score, 60);
    matchReason = matchReason || 'cuisine';
  }
  if (catLower.includes(corrected) || catLower.includes(normalized)) {
    score = Math.max(score, 55);
    matchReason = matchReason || 'category';
  }

  // 7. Description keyword matching
  if (corrected && descLower.includes(corrected)) {
    score = Math.max(score, 50);
  }

  if (score >= 45) {
    return { recipe, score, matchReason, matchedIngredient };
  }

  return null;
}

/**
 * Fetch recipes from TheMealDB public free API (fallback/external provider)
 */
async function fetchMealDbRecipes(query: string, signal?: AbortSignal): Promise<ExtendedRecipe[]> {
  const cached = getCachedExternalRecipes(query);
  if (cached) return cached;

  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.meals || !Array.isArray(data.meals)) {
      setCachedExternalRecipes(query, []);
      return [];
    }

    const recipes: ExtendedRecipe[] = data.meals.slice(0, 8).map((m: any) => {
      // Parse ingredients and measurements
      const ingredients: RecipeIngredient[] = [];
      for (let i = 1; i <= 20; i++) {
        const name = m[`strIngredient${i}`];
        const measure = m[`strMeasure${i}`];
        if (name && name.trim()) {
          ingredients.push({
            name: name.trim(),
            quantity: measure && measure.trim() ? measure.trim() : '1 serving',
            checked: false,
          });
        }
      }

      // Parse instructions
      const rawInst = m.strInstructions || '';
      const instructions = rawInst
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 10);

      const category = m.strCategory || 'International';
      const cuisine = m.strArea || 'International';

      return {
        id: `mealdb_${m.idMeal}`,
        household_id: 'h_default_household_01',
        title: m.strMeal,
        prep_time: '20 mins',
        cook_time: '25 mins',
        total_time: '45 mins',
        serves: 'Serves 4',
        servings_count: 4,
        difficulty: 'Medium',
        description: `Authentic ${cuisine} ${m.strMeal}. Carefully prepared with fresh ingredients.`,
        image_url: m.strMealThumb,
        category: category,
        cuisine: cuisine === 'Indian' ? 'North Indian' : 'International',
        diet: category.toLowerCase().includes('vegetarian') ? 'Vegetarian' : 'Non-Vegetarian',
        meal_type: 'Dinner',
        ingredients: ingredients.length > 0 ? ingredients : [{ name: 'Assorted Spices', quantity: 'To taste' }],
        instructions: instructions.length > 0 ? instructions : ['Prepare fresh ingredients and cook according to traditional method.'],
        created_at: new Date().toISOString(),
        tags: [m.strMeal.toLowerCase(), category.toLowerCase(), cuisine.toLowerCase()],
      };
    });

    setCachedExternalRecipes(query, recipes);
    return recipes;
  } catch {
    return [];
  }
}

/**
 * Master Search function:
 * Searches local comprehensive recipes + user saved recipes + cached external results
 */
export async function searchRecipes(
  query: string,
  userSavedRecipes: Recipe[] = [],
  options: {
    category?: string;
    cuisine?: string;
    diet?: string;
    quickOnly?: boolean;
    includeExternal?: boolean;
    abortSignal?: AbortSignal;
  } = {}
): Promise<SearchResponse> {
  const queryInfo = normalizeSearchQuery(query);
  const { normalized, corrected, hasCorrection } = queryInfo;

  // Deduplicate and combine all local sources
  const recipeMap = new Map<string, ExtendedRecipe>();

  // 1. Load user saved recipes first
  for (const r of userSavedRecipes) {
    recipeMap.set(r.id, r as ExtendedRecipe);
  }

  // 2. Load comprehensive catalog
  for (const r of COMPREHENSIVE_RECIPES) {
    if (!recipeMap.has(r.id)) {
      recipeMap.set(r.id, r);
    }
  }

  const allLocal = Array.from(recipeMap.values());

  // If no query string, return catalog filtered by active facets
  if (!normalized) {
    let results = allLocal;

    if (options.category && options.category !== 'All') {
      results = results.filter((r) => r.category.toLowerCase() === options.category!.toLowerCase());
    }
    if (options.cuisine && options.cuisine !== 'All') {
      results = results.filter((r) => r.cuisine?.toLowerCase() === options.cuisine!.toLowerCase());
    }
    if (options.diet && options.diet !== 'All') {
      results = results.filter((r) => r.diet?.toLowerCase() === options.diet!.toLowerCase());
    }
    if (options.quickOnly) {
      results = results.filter((r) => {
        const time = parseInt(r.prep_time || '0', 10);
        return time > 0 && time <= 25;
      });
    }

    return {
      results,
      correctedTerm: null,
      totalCount: results.length,
      isExternalSearching: false,
    };
  }

  // Score local recipes
  const scoredResults: SearchResult[] = [];
  for (const recipe of allLocal) {
    const scored = scoreRecipe(recipe, queryInfo);
    if (scored) {
      scoredResults.push(scored);
    }
  }

  // Sort descending by score
  scoredResults.sort((a, b) => b.score - a.score);

  let finalRecipes = scoredResults.map((sr) => sr.recipe);

  // If user requested external results or local search yielded few results and external is allowed
  if (options.includeExternal && query.length >= 3 && !hasCorrection) {
    try {
      const externalMeals = await fetchMealDbRecipes(query, options.abortSignal);
      for (const em of externalMeals) {
        if (!finalRecipes.some((r) => r.title.toLowerCase() === em.title.toLowerCase())) {
          finalRecipes.push(em);
        }
      }
    } catch {
      // Graceful fallback: local results remain unaffected
    }
  }

  // Apply facets to search results
  if (options.category && options.category !== 'All') {
    finalRecipes = finalRecipes.filter((r) => r.category.toLowerCase() === options.category!.toLowerCase());
  }
  if (options.cuisine && options.cuisine !== 'All') {
    finalRecipes = finalRecipes.filter((r) => r.cuisine?.toLowerCase() === options.cuisine!.toLowerCase());
  }
  if (options.diet && options.diet !== 'All') {
    finalRecipes = finalRecipes.filter((r) => r.diet?.toLowerCase() === options.diet!.toLowerCase());
  }
  if (options.quickOnly) {
    finalRecipes = finalRecipes.filter((r) => {
      const time = parseInt(r.prep_time || '0', 10);
      return time > 0 && time <= 25;
    });
  }

  return {
    results: finalRecipes,
    correctedTerm: hasCorrection ? corrected : null,
    totalCount: finalRecipes.length,
    isExternalSearching: false,
  };
}

/**
 * Autocomplete suggestions generator while typing
 */
export function getRecipeSuggestions(query: string, allRecipes: Recipe[] = COMPREHENSIVE_RECIPES): string[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return [];

  const { corrected } = normalizeSearchQuery(trimmed);
  const target = corrected || trimmed;

  const suggestions = new Set<string>();

  for (const r of allRecipes) {
    const title = r.title;
    const lower = title.toLowerCase();

    if (lower.startsWith(target) || lower.includes(target)) {
      suggestions.add(title);
    }
  }

  return Array.from(suggestions).slice(0, 5);
}
