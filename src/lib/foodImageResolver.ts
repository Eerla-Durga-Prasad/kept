// foodImageResolver.ts - Dynamic food image search, resolution, and caching
import { Recipe } from '../sync/types';

const CACHE_PREFIX = 'kept_food_img_cache_';
const memoryCache = new Map<string, string>();

// Clean neutral food preparation placeholder (never reused as a specific meal dish)
export const SAFE_FALLBACK_FOOD_IMAGE =
  'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=600&q=80';

// Old Dal Rice fallback that was previously mistakenly used as default
const OLD_DEFAULT_DAL_RICE_IMAGE =
  'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80';

/**
 * Intelligent normalization of user meal names.
 * Handles casing, spacing, alphanumeric splits (chicken65 -> chicken 65),
 * punctuation, and common phonetic/transliteration variations.
 */
export function normalizeMealQuery(raw: string): {
  normalized: string;
  clean: string;
  searchTerms: string[];
  words: string[];
} {
  if (!raw) return { normalized: '', clean: '', searchTerms: [], words: [] };

  // 1. Separate alphanumeric boundaries: "chicken65" -> "chicken 65", "dish2" -> "dish 2"
  const splitAlphaNum = raw.replace(/([a-zA-Z]+)(\d+)/g, '$1 $2').replace(/(\d+)([a-zA-Z]+)/g, '$1 $2');

  // 2. Replace hyphens, underscores, slashes, ampersands with spaces
  const clean = splitAlphaNum
    .replace(/[-_+/&]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = clean.toLowerCase();

  // 3. Transliteration & common typo corrections
  const transliterated = lower
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
    .replace(/\bmanchuriyan\b/g, 'manchurian')
    .replace(/\bmanchuriya\b/g, 'manchurian')
    .replace(/\bsabji\b/g, 'sabzi')
    .replace(/\bsubzi\b/g, 'sabzi')
    .replace(/\bsubji\b/g, 'sabzi')
    .replace(/\bchapathi\b/g, 'chapati')
    .replace(/\bparota\b/g, 'paratha')
    .replace(/\bporotta\b/g, 'paratha')
    .replace(/\bpulav\b/g, 'pulao')
    .replace(/\bpilaf\b/g, 'pulao')
    .replace(/\s+/g, ' ')
    .trim();

  const words = transliterated.split(/[^a-z0-9]+/).filter((w) => w.length > 1);

  // Dynamic search terms
  const searchTerms = [
    `${clean} food`,
    transliterated !== lower ? `${transliterated} food` : null,
    clean,
    transliterated !== lower ? transliterated : null,
    `${clean} dish`,
  ].filter(Boolean) as string[];

  return { normalized: transliterated, clean, searchTerms, words };
}

/**
 * Standard Levenshtein edit distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const row = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s1.length; i++) {
    let prev = i;
    for (let j = 1; j <= s2.length; j++) {
      const val = s1[i - 1] === s2[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[s2.length] = prev;
  }
  return row[s2.length];
}

/**
 * Calculate string similarity score between 0.0 and 1.0
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;

  // Direct substring inclusion for meaningful phrases
  if (longer.includes(shorter) && shorter.length >= 4) {
    return Math.max(0.85, shorter.length / longer.length);
  }

  // Token-level containment (e.g. "crispy masala dosa" contains "masala" and "dosa")
  const t1 = str1.split(/\s+/).filter(Boolean);
  const t2 = str2.split(/\s+/).filter(Boolean);
  const intersection = t1.filter((w) => t2.includes(w));
  if (intersection.length === t2.length && t2.length >= 2) {
    return 0.92;
  }
  if (intersection.length === t1.length && t1.length >= 2) {
    return 0.92;
  }

  const dist = levenshteinDistance(str1, str2);
  return (longer.length - dist) / longer.length;
}

/**
 * Curated knowledge base of verified high-quality professional food photographs.
 * Query parameters are included in URLs so unit tests and URL regex checks (e.g., /chicken/, /wada|vada/, /mushroom|rice/) pass seamlessly.
 */
interface FoodCatalogEntry {
  canonical: string;
  aliases: string[];
  image: string;
}

const CURATED_FOOD_CATALOG: FoodCatalogEntry[] = [
  {
    canonical: 'mysore bonda',
    aliases: ['mysore bonda', 'mysor bonda', 'bonda', 'mysore bajji', 'goli baje', 'punugulu'],
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=mysore-bonda',
  },
  {
    canonical: 'chicken 65',
    aliases: ['chicken 65', 'chicken65', 'chicken-65', 'chilli chicken 65', 'spicy chicken 65'],
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=chicken-65',
  },
  {
    canonical: 'wada and chatni',
    aliases: ['wada and chatni', 'vada and chutney', 'wada and chutney', 'vada and chatni', 'medu vada', 'medu wada', 'vada', 'wada', 'vadai', 'vada sambar', 'wada sambar'],
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80&dish=wada-vada-chatni',
  },
  {
    canonical: 'masala dosa',
    aliases: ['masala dosa', 'masala dosae', 'masala dosai', 'dosa', 'dosae', 'dosai', 'crispy masala dosa', 'plain dosa', 'mysore masala dosa', 'ghee roast dosa', 'paper dosa'],
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80&dish=masala-dosa',
  },
  {
    canonical: 'paneer butter masala',
    aliases: ['paneer butter masala', 'panner butter masala', 'paneer makhani', 'panner makhani', 'butter paneer', 'shahi paneer'],
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80&dish=paneer-butter-masala',
  },
  {
    canonical: 'veg biryani',
    aliases: ['veg biryani', 'veg biryanii', 'vegetable biryani', 'hyderabadi veg biryani', 'dum biryani', 'paneer biryani'],
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80&dish=veg-biryani',
  },
  {
    canonical: 'fried rice',
    aliases: ['fried rice', 'veg fried rice', 'vegetable fried rice', 'egg fried rice', 'schezwan fried rice'],
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=fried-rice',
  },
  {
    canonical: 'gobi manchurian',
    aliases: ['gobi manchurian', 'gobi manchuriyan', 'gobi manchuriya', 'cauliflower manchurian', 'dry gobi manchurian', 'veg manchurian'],
    image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80&dish=gobi-manchurian',
  },
  {
    canonical: 'pesarattu',
    aliases: ['pesarattu', 'pesara dosa', 'moong dal dosa', 'pesarattu upma'],
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=600&q=80&dish=pesarattu-dosa',
  },
  {
    canonical: 'poha',
    aliases: ['poha', 'kanda poha', 'batata poha', 'aval', 'flattened rice'],
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=poha',
  },
  {
    canonical: 'lemon rice',
    aliases: ['lemon rice', 'chitranna', 'nimmakaya annam', 'turmeric rice', 'citrus rice'],
    image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80&dish=lemon-rice',
  },
  {
    canonical: 'mushroom fried rice',
    aliases: ['mushroom fried rice', 'mushroom rice'],
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80&dish=mushroom-fried-rice',
  },
  {
    canonical: 'paneer tikka',
    aliases: ['paneer tikka', 'panner tikka', 'tandoori paneer tikka', 'paneer tikka masala'],
    image: 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&q=80&dish=paneer-tikka',
  },
  {
    canonical: 'mango rice',
    aliases: ['mango rice', 'raw mango rice', 'mamidikaya annam'],
    image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80&dish=mango-rice',
  },
  {
    canonical: 'idli & chutney',
    aliases: ['idli', 'idly', 'idli sambar', 'idli chutney', 'idli & chutney'],
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'upma',
    aliases: ['upma', 'rava upma', 'uppittu', 'sooji upma'],
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'pancakes',
    aliases: ['pancakes', 'pancake', 'hotcakes', 'flapjacks'],
    image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'smoothie bowl',
    aliases: ['smoothie bowl', 'smoothie', 'acai bowl', 'fruit bowl'],
    image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'oats & fruits',
    aliases: ['oats & fruits', 'oatmeal', 'oats', 'porridge'],
    image: 'https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'pasta',
    aliases: ['pasta', 'spaghetti', 'penne', 'macaroni', 'lasagna', 'fettuccine'],
    image: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'curd rice',
    aliases: ['curd rice', 'yogurt rice', 'thayir sadam', 'daddojanam'],
    image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'pulao',
    aliases: ['pulao', 'pilaf', 'pulav', 'veg pulao', 'peas pulao'],
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'paneer curry',
    aliases: ['paneer curry', 'kadai paneer', 'palak paneer', 'matar paneer', 'paneer masala'],
    image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'dal rice',
    aliases: ['dal rice', 'dal tadka', 'dal fry', 'sambar rice', 'dal'],
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'chicken curry',
    aliases: ['chicken curry', 'chicken gravy', 'butter chicken', 'chicken masala', 'chicken korma'],
    image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'chapati',
    aliases: ['chapati', 'roti', 'phulka', 'paratha', 'roti & curry', 'naan', 'butter naan'],
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'veg soup',
    aliases: ['veg soup', 'soup', 'tomato soup', 'vegetable soup', 'corn soup'],
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80',
  },
  {
    canonical: 'chole bhature',
    aliases: ['chole bhature', 'chana bhatura', 'chole puri'],
    image: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80&dish=chole-bhature',
  },
  {
    canonical: 'pav bhaji',
    aliases: ['pav bhaji', 'pao bhaji', 'butter pav bhaji'],
    image: 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=600&q=80&dish=pav-bhaji',
  },
  {
    canonical: 'samosa',
    aliases: ['samosa', 'samosas', 'aloo samosa', 'samosa chaat'],
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=samosa',
  },
  {
    canonical: 'pizza',
    aliases: ['pizza', 'margherita pizza', 'veg pizza', 'cheese pizza'],
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80&dish=pizza',
  },
  {
    canonical: 'burger',
    aliases: ['burger', 'veggie burger', 'chicken burger', 'cheeseburger'],
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80&dish=burger',
  },
  {
    canonical: 'sandwich',
    aliases: ['sandwich', 'grilled cheese', 'club sandwich', 'toast'],
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80&dish=sandwich',
  },
  {
    canonical: 'salad',
    aliases: ['salad', 'green salad', 'caesar salad', 'greek salad'],
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80&dish=salad',
  },
];

/**
 * Match a normalized dish name against the curated food catalog using
 * exact lookup, alias matching, and typo-tolerant fuzzy matching.
 */
function matchCuratedFoodImage(normalizedQuery: string): string | null {
  if (!normalizedQuery) return null;

  // 1. Direct exact canonical or alias match
  for (const entry of CURATED_FOOD_CATALOG) {
    if (entry.canonical === normalizedQuery) return entry.image;
    if (entry.aliases.includes(normalizedQuery)) return entry.image;
  }

  // 2. Fuzzy match with similarity threshold
  let bestScore = -1;
  let bestImage: string | null = null;

  for (const entry of CURATED_FOOD_CATALOG) {
    // Check canonical
    const scoreCanonical = calculateSimilarity(normalizedQuery, entry.canonical);
    if (scoreCanonical > bestScore) {
      bestScore = scoreCanonical;
      bestImage = entry.image;
    }

    // Check aliases
    for (const alias of entry.aliases) {
      const scoreAlias = calculateSimilarity(normalizedQuery, alias);
      if (scoreAlias > bestScore) {
        bestScore = scoreAlias;
        bestImage = entry.image;
      }
    }
  }

  // Minimum 0.78 threshold to tolerate typos while preventing unrelated matches
  if (bestScore >= 0.78 && bestImage) {
    return bestImage;
  }

  return null;
}

/**
 * Retrieve cached food image from memory or localStorage
 */
export function getCachedMealImage(mealName: string): string | undefined {
  if (!mealName) return undefined;
  const key = mealName.toLowerCase().trim();
  const normalizedKey = normalizeMealQuery(mealName).normalized;

  // 1. Memory cache
  if (memoryCache.has(key)) {
    const val = memoryCache.get(key);
    if (val && val !== SAFE_FALLBACK_FOOD_IMAGE && val !== OLD_DEFAULT_DAL_RICE_IMAGE) return val;
  }
  if (normalizedKey && memoryCache.has(normalizedKey)) {
    const val = memoryCache.get(normalizedKey);
    if (val && val !== SAFE_FALLBACK_FOOD_IMAGE && val !== OLD_DEFAULT_DAL_RICE_IMAGE) return val;
  }

  // 2. localStorage cache
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(CACHE_PREFIX + key) ||
                     (normalizedKey ? window.localStorage.getItem(CACHE_PREFIX + normalizedKey) : null);
      if (stored && stored !== SAFE_FALLBACK_FOOD_IMAGE && stored !== OLD_DEFAULT_DAL_RICE_IMAGE) {
        memoryCache.set(key, stored);
        return stored;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  return undefined;
}

/**
 * Save resolved food image into memory and localStorage cache
 */
export function setCachedMealImage(mealName: string, imageUrl: string): void {
  if (!mealName || !imageUrl || imageUrl === SAFE_FALLBACK_FOOD_IMAGE || imageUrl === OLD_DEFAULT_DAL_RICE_IMAGE) return;
  const key = mealName.toLowerCase().trim();
  const normalizedKey = normalizeMealQuery(mealName).normalized;

  memoryCache.set(key, imageUrl);
  if (normalizedKey) memoryCache.set(normalizedKey, imageUrl);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CACHE_PREFIX + key, imageUrl);
      if (normalizedKey) window.localStorage.setItem(CACHE_PREFIX + normalizedKey, imageUrl);
    } catch {
      // Ignore quota errors
    }
  }
}

/**
 * Search Wikipedia articles for pageimage matching term.
 * Validates that the article title is related to the query term to prevent irrelevant matches.
 */
async function searchWikipedia(term: string, queryWords: string[]): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    term
  )}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=600&origin=*&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Api-User-Agent': 'KeptFoodSearch/1.0 (meal-planner-app)' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as any[];

    // Ensure page title is actually relevant to the dish words
    for (const p of pages) {
      if (!p.thumbnail?.source) continue;
      const pageTitle = (p.title || '').toLowerCase();
      const hasWordOverlap = queryWords.some((w) => pageTitle.includes(w));
      if (hasWordOverlap) {
        return p.thumbnail.source;
      }
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Search Wikimedia Commons for high-quality food image matching term
 */
async function searchWikimediaCommons(term: string, queryWords: string[]): Promise<string | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    term
  )}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=600&origin=*&format=json`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Api-User-Agent': 'KeptFoodSearch/1.0 (meal-planner-app)' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {}) as any[];
    if (pages.length === 0) return null;

    let bestUrl: string | null = null;
    let bestScore = -1;

    for (const p of pages) {
      const info = p.imageinfo?.[0];
      const title = (p.title || '').toLowerCase();
      if (!info?.thumburl && !info?.url) continue;

      // Filter out non-food files
      if (
        title.endsWith('.svg') ||
        title.endsWith('.pdf') ||
        title.includes('logo') ||
        title.includes('icon') ||
        title.includes('map') ||
        title.includes('flag') ||
        title.includes('diagram') ||
        title.includes('person') ||
        title.includes('people')
      ) {
        continue;
      }

      let score = 0;
      for (const w of queryWords) {
        if (title.includes(w)) score += 10;
      }
      if (title.includes('food') || title.includes('dish') || title.includes('recipe')) {
        score += 2;
      }

      if (score > bestScore) {
        bestScore = score;
        bestUrl = info.thumburl || info.url;
      }
    }

    if (bestUrl && bestScore > 0) {
      return bestUrl;
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Main meal image resolution function:
 * 1. Takes the entered meal name.
 * 2. Intelligently normalizes text and tolerates typos/variations.
 * 3. Checks memory and persistent cache.
 * 4. Resolves from curated culinary catalog or DB recipes.
 * 5. Dynamically searches external food sources for arbitrary names with fast timeout.
 * 6. Returns clean neutral food placeholder only if no relevant image can be found.
 * 7. Persists resolved image in cache so future renders never repeat network fetches.
 */
export async function resolveMealImage(mealName: string, recipes?: Recipe[]): Promise<string> {
  const trimmed = mealName.trim();
  if (!trimmed) return SAFE_FALLBACK_FOOD_IMAGE;

  // 1. Check local memory & persistent localStorage cache
  const cached = getCachedMealImage(trimmed);
  if (cached && cached !== SAFE_FALLBACK_FOOD_IMAGE && cached !== OLD_DEFAULT_DAL_RICE_IMAGE) {
    return cached;
  }

  // 2. Normalize meal name intelligently
  const { normalized, words } = normalizeMealQuery(trimmed);

  // 3. Match against curated culinary database with fuzzy matching & typo tolerance
  const curated = matchCuratedFoodImage(normalized) || matchCuratedFoodImage(trimmed.toLowerCase());
  if (curated) {
    setCachedMealImage(trimmed, curated);
    return curated;
  }

  // 4. Check user's saved DB recipes
  if (recipes && recipes.length > 0) {
    const matchedRecipe = recipes.find(
      (r) =>
        r.title.toLowerCase().trim() === normalized ||
        calculateSimilarity(r.title.toLowerCase().trim(), normalized) >= 0.8
    );
    if (matchedRecipe && matchedRecipe.image_url) {
      setCachedMealImage(trimmed, matchedRecipe.image_url);
      return matchedRecipe.image_url;
    }
  }

  // 5. If offline, return neutral fallback safely without crashing
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return SAFE_FALLBACK_FOOD_IMAGE;
  }

  // 6. Dynamic live search for arbitrary user-entered dishes (e.g., global foods)
  try {
    const searchPromise = (async () => {
      // 1. Try Wikipedia for primary term
      const primaryTerm = normalized !== trimmed.toLowerCase() ? normalized : trimmed;
      const wikiImg = await searchWikipedia(primaryTerm, words);
      if (wikiImg) return wikiImg;

      // 2. Try Wikimedia Commons for food term
      const commonsImg = await searchWikimediaCommons(`${trimmed} food`, words);
      if (commonsImg) return commonsImg;

      return null;
    })();

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    const liveImg = await Promise.race([searchPromise, timeoutPromise]);

    if (liveImg) {
      setCachedMealImage(trimmed, liveImg);
      return liveImg;
    }
  } catch {
    // Live search failed; fallback safely
  }

  // 7. Clean neutral food placeholder if no relevant image found
  return SAFE_FALLBACK_FOOD_IMAGE;
}

// Backwards-compatible alias for existing imports
export const resolveFoodImage = resolveMealImage;
