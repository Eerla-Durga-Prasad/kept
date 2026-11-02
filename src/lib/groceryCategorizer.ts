import { CategoryType } from '../sync/types';

export interface CategoryDetectionResult {
  category: CategoryType | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchedKeyword?: string;
  isAmbiguous?: boolean;
  candidateCategories?: CategoryType[];
}

export const ALL_CATEGORIES: CategoryType[] = [
  'Produce',
  'Dairy',
  'Pantry',
  'Meat & Seafood',
  'Household',
];

/**
 * Normalizes input string for grocery classification.
 * Trims, converts to lowercase, strips common packaging/quantity tokens, and normalizes punctuation.
 */
export function normalizeItemName(name: string): string {
  if (!name) return '';
  let cleaned = name.toLowerCase().trim();

  // Remove common quantity prefixes/suffixes like "500g", "1 kg", "2 packs", "1 ltr", "2 bunches", "1 dozen"
  cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(kg|g|gm|gms|kilo|kilos|l|lt|ltr|ml|pack|packs|packet|packets|bunch|bunches|dozen|box|bottle|tin|can|piece|pieces|pcs)\b/gi, ' ');
  // Remove numbers
  cleaned = cleaned.replace(/\b\d+\b/g, ' ');
  // Remove non-alphanumeric except spaces and hyphens
  cleaned = cleaned.replace(/[^a-z0-9\s-]/g, ' ');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Exact and prefix compound phrases that determine category with highest confidence.
 * Checked BEFORE single-word token matching to handle multi-word items like "coconut oil" vs "coconut".
 */
interface CompoundRule {
  pattern: RegExp;
  category: CategoryType;
  keyword: string;
}

const COMPOUND_RULES: CompoundRule[] = [
  // Dairy compounds
  { pattern: /\b(cottage cheese|cream cheese|sour cream|heavy cream|whipping cream|fresh cream)\b/i, category: 'Dairy', keyword: 'cheese/cream' },
  { pattern: /\b(greek yogurt|almond milk|oat milk|soy milk|coconut milk|condensed milk|evaporated milk|milk powder)\b/i, category: 'Dairy', keyword: 'milk/yogurt' },
  { pattern: /\b(clarified butter|salted butter|unsalted butter)\b/i, category: 'Dairy', keyword: 'butter' },

  // Pantry compounds (liquids, oils, spices, dry blends)
  { pattern: /\b(coconut oil|olive oil|sunflower oil|mustard oil|sesame oil|peanut oil|groundnut oil|canola oil|vegetable oil|cooking oil|gingelly oil)\b/i, category: 'Pantry', keyword: 'cooking oil' },
  { pattern: /\b(red ch(?:i|il)li powder|ch(?:i|il)li powder|chili flakes|pepper powder|mirchi powder|karam podi)\b/i, category: 'Pantry', keyword: 'spice powder' },
  { pattern: /\b(garam masala|sambar powder|rasam powder|biryani masala|chaat masala|chana masala|curry powder|pav bhaji masala|kitchen king)\b/i, category: 'Pantry', keyword: 'masala blend' },
  { pattern: /\b(baking powder|baking soda|active dry yeast|cocoa powder|vanilla extract)\b/i, category: 'Pantry', keyword: 'baking essential' },
  { pattern: /\b(brown rice|basmati rice|sona masoori|idli rava|dosa rice|jasmine rice|wild rice)\b/i, category: 'Pantry', keyword: 'rice specialty' },
  { pattern: /\b(whole wheat flour|all purpose flour|gram flour|rice flour|corn flour|corn starch)\b/i, category: 'Pantry', keyword: 'flour' },
  { pattern: /\b(peanut butter|tomato ketchup|tomato sauce|soy sauce|chili sauce|hot sauce)\b/i, category: 'Pantry', keyword: 'condiment' },
  { pattern: /\b(green tea|black tea|tea powder|tea leaves|instant coffee|filter coffee|coffee powder|coffee beans)\b/i, category: 'Pantry', keyword: 'beverage' },

  // Meat & Seafood compounds
  { pattern: /\b(chicken breast|chicken thigh|chicken wings|chicken keema|chicken drumstick|chicken curry cut|chicken lollipops)\b/i, category: 'Meat & Seafood', keyword: 'chicken cut' },
  { pattern: /\b(mutton keema|mutton curry cut|lamb chops|goat meat|pork ribs|minced meat|minced chicken|minced mutton)\b/i, category: 'Meat & Seafood', keyword: 'meat cut' },
  { pattern: /\b(seer fish|salmon fillet|tuna can|pomfret fish|rohu fish|catla fish|fish fillet|fish fingers)\b/i, category: 'Meat & Seafood', keyword: 'fish cut' },
  { pattern: /\b(tiger prawns|jumbo prawns|white shrimp|crab meat|squid rings)\b/i, category: 'Meat & Seafood', keyword: 'seafood cut' },
  { pattern: /\b(chicken eggs|brown eggs|duck eggs|boiled eggs|egg whites)\b/i, category: 'Meat & Seafood', keyword: 'eggs' },

  // Produce compounds
  { pattern: /\b(curry leaves|mint leaves|coriander leaves|fenugreek leaves|bay leaf|cilantro leaves|spring onion|green onion)\b/i, category: 'Produce', keyword: 'fresh herbs' },
  { pattern: /\b(green ch(?:i|il)li|green ch(?:i|il)lies|hari mirch|pachi mirchi|pachai milagai)\b/i, category: 'Produce', keyword: 'fresh chilies' },
  { pattern: /\b(bell pepper|capsicum|shimla mirch|sweet potato|baby corn|sweet corn|french beans|green beans|cluster beans|broad beans)\b/i, category: 'Produce', keyword: 'vegetable' },
  { pattern: /\b(bottle gourd|bitter gourd|ridge gourd|snake gourd|ash gourd|ivy gourd)\b/i, category: 'Produce', keyword: 'gourd' },
  { pattern: /\b(lady finger|ladies finger)\b/i, category: 'Produce', keyword: 'okra' },

  // Household compounds
  { pattern: /\b(dish soap|dishwash liquid|dishwash bar|dishwasher pods|dishwasher tablet|dishwasher detergent)\b/i, category: 'Household', keyword: 'dish cleaning' },
  { pattern: /\b(laundry detergent|washing powder|fabric softener|fabric conditioner|liquid detergent)\b/i, category: 'Household', keyword: 'laundry' },
  { pattern: /\b(floor cleaner|toilet cleaner|bathroom cleaner|glass cleaner|surface cleaner|disinfectant spray)\b/i, category: 'Household', keyword: 'household cleaner' },
  { pattern: /\b(garbage bags|trash bags|dustbin bags|bin liners)\b/i, category: 'Household', keyword: 'trash bags' },
  { pattern: /\b(paper towels|toilet paper|tissue paper|facial tissues|wet wipes|cling film|aluminum foil|aluminium foil|baking paper|parchment paper)\b/i, category: 'Household', keyword: 'paper/wrap' },
  { pattern: /\b(hand wash|hand soap|body wash|shower gel|bath soap)\b/i, category: 'Household', keyword: 'personal care' },
  { pattern: /\b(mosquito repellent|good knight|all out|hit spray|insect repellent)\b/i, category: 'Household', keyword: 'pest control' },
  { pattern: /\b(scotch brite|scrub pad|cleaning sponge|steel wool|floor mop|broom stick)\b/i, category: 'Household', keyword: 'cleaning tool' },
];

/**
 * Canonical dictionary mapping singular keywords and regional terms to CategoryType.
 * Supports English, Hindi, Telugu, Tamil, and common phonetics/spelling variations.
 */
const GROCERY_DICTIONARY: Record<string, CategoryType> = {
  // ================= PRODUCE (Fruits, Vegetables, Fresh Greens & Roots) =================
  // Fruits
  apple: 'Produce',
  apples: 'Produce',
  banana: 'Produce',
  bananas: 'Produce',
  kela: 'Produce',
  arati: 'Produce',
  arathipazham: 'Produce',
  orange: 'Produce',
  oranges: 'Produce',
  santara: 'Produce',
  mosambi: 'Produce',
  mango: 'Produce',
  mangoes: 'Produce',
  aam: 'Produce',
  mamidi: 'Produce',
  manga: 'Produce',
  grapes: 'Produce',
  angoor: 'Produce',
  draksha: 'Produce',
  watermelon: 'Produce',
  tarbooj: 'Produce',
  pappaya: 'Produce',
  papaya: 'Produce',
  guava: 'Produce',
  amrood: 'Produce',
  pomegranate: 'Produce',
  anar: 'Produce',
  danimma: 'Produce',
  lemon: 'Produce',
  lemons: 'Produce',
  nimbu: 'Produce',
  nimmakaya: 'Produce',
  lime: 'Produce',
  limes: 'Produce',
  strawberry: 'Produce',
  strawberries: 'Produce',
  blueberry: 'Produce',
  blueberries: 'Produce',
  blackberry: 'Produce',
  raspberry: 'Produce',
  pineapple: 'Produce',
  ananas: 'Produce',
  avocado: 'Produce',
  avocados: 'Produce',
  kiwi: 'Produce',
  pear: 'Produce',
  pears: 'Produce',
  peach: 'Produce',
  peaches: 'Produce',
  plum: 'Produce',
  chikoo: 'Produce',
  sapota: 'Produce',
  sitaphal: 'Produce',
  custardapple: 'Produce',

  // Vegetables & Roots
  tomato: 'Produce',
  tomatoes: 'Produce',
  tamatar: 'Produce',
  tamata: 'Produce',
  thakkali: 'Produce',
  potato: 'Produce',
  potatoes: 'Produce',
  aloo: 'Produce',
  alu: 'Produce',
  bangaladumpa: 'Produce',
  urulaikizhangu: 'Produce',
  onion: 'Produce',
  onions: 'Produce',
  pyaz: 'Produce',
  pyaaz: 'Produce',
  ullipaya: 'Produce',
  vengayam: 'Produce',
  garlic: 'Produce',
  lehsun: 'Produce',
  lahsun: 'Produce',
  vellulli: 'Produce',
  poondu: 'Produce',
  ginger: 'Produce',
  adrak: 'Produce',
  allam: 'Produce',
  inji: 'Produce',
  carrot: 'Produce',
  carrots: 'Produce',
  gajar: 'Produce',
  cabbage: 'Produce',
  patagobi: 'Produce',
  bandgobi: 'Produce',
  cauliflower: 'Produce',
  phoolgobi: 'Produce',
  gobi: 'Produce',
  broccoli: 'Produce',
  capsicum: 'Produce',
  shimlamirch: 'Produce',
  cucumber: 'Produce',
  cucumbers: 'Produce',
  kheera: 'Produce',
  kakdi: 'Produce',
  dosakaya: 'Produce',
  vellarikkai: 'Produce',
  brinjal: 'Produce',
  eggplant: 'Produce',
  baingan: 'Produce',
  vankaya: 'Produce',
  kathirikai: 'Produce',
  okra: 'Produce',
  bhindi: 'Produce',
  bhendi: 'Produce',
  bendakaya: 'Produce',
  vendakkai: 'Produce',
  matar: 'Produce',
  peas: 'Produce',
  greenpeas: 'Produce',
  beetroot: 'Produce',
  chukandar: 'Produce',
  radish: 'Produce',
  mooli: 'Produce',
  mullangi: 'Produce',
  pumpkin: 'Produce',
  kaddu: 'Produce',
  gummadikaya: 'Produce',
  lauki: 'Produce',
  sorakaya: 'Produce',
  suraikai: 'Produce',
  karela: 'Produce',
  kakarakaya: 'Produce',
  pavakkai: 'Produce',
  turai: 'Produce',
  beerakaya: 'Produce',
  peerkangai: 'Produce',
  drumstick: 'Produce',
  drumsticks: 'Produce',
  sahjan: 'Produce',
  munakkaya: 'Produce',
  murungakkai: 'Produce',
  mushroom: 'Produce',
  mushrooms: 'Produce',
  khumb: 'Produce',
  arbi: 'Produce',
  chamadumpa: 'Produce',
  colocasia: 'Produce',
  dondakaya: 'Produce',
  tindora: 'Produce',
  kundru: 'Produce',
  potlakaya: 'Produce',
  zucchini: 'Produce',
  lettuce: 'Produce',
  celery: 'Produce',
  coconut: 'Produce',
  kobbari: 'Produce',
  nariyal: 'Produce',
  thengai: 'Produce',

  // Fresh Herbs & Greens
  spinach: 'Produce',
  palak: 'Produce',
  palakura: 'Produce',
  coriander: 'Produce',
  cilantro: 'Produce',
  dhaniya: 'Produce',
  kothmir: 'Produce',
  kothimeera: 'Produce',
  kothamalli: 'Produce',
  mint: 'Produce',
  pudina: 'Produce',
  methi: 'Produce',
  fenugreek: 'Produce',
  menthikura: 'Produce',
  curryleaves: 'Produce',
  kadipatta: 'Produce',
  karivepaku: 'Produce',
  karuveppilai: 'Produce',
  keerai: 'Produce',
  gongura: 'Produce',
  thotakura: 'Produce',

  // ================= DAIRY =================
  milk: 'Dairy',
  doodh: 'Dairy',
  paalu: 'Dairy',
  paal: 'Dairy',
  curd: 'Dairy',
  dahi: 'Dairy',
  perugu: 'Dairy',
  thayir: 'Dairy',
  yogurt: 'Dairy',
  yoghurt: 'Dairy',
  cheese: 'Dairy',
  cheddar: 'Dairy',
  mozzarella: 'Dairy',
  parmesan: 'Dairy',
  paneer: 'Dairy',
  panir: 'Dairy',
  tofu: 'Dairy',
  butter: 'Dairy',
  makhan: 'Dairy',
  makkhan: 'Dairy',
  venna: 'Dairy',
  vennai: 'Dairy',
  ghee: 'Dairy',
  neyyi: 'Dairy',
  nei: 'Dairy',
  cream: 'Dairy',
  malai: 'Dairy',
  buttermilk: 'Dairy',
  chaas: 'Dairy',
  majjiga: 'Dairy',
  mor: 'Dairy',
  lassi: 'Dairy',
  khoa: 'Dairy',
  mawa: 'Dairy',

  // ================= PANTRY (Grains, Dals, Spices, Oils, Dry Goods) =================
  // Grains & Flours
  rice: 'Pantry',
  chawal: 'Pantry',
  biyyam: 'Pantry',
  arisi: 'Pantry',
  basmati: 'Pantry',
  wheat: 'Pantry',
  gehu: 'Pantry',
  godhumalu: 'Pantry',
  atta: 'Pantry',
  aata: 'Pantry',
  maida: 'Pantry',
  besan: 'Pantry',
  senagapindi: 'Pantry',
  rava: 'Pantry',
  sooji: 'Pantry',
  suji: 'Pantry',
  semolina: 'Pantry',
  poha: 'Pantry',
  aval: 'Pantry',
  atukulu: 'Pantry',
  oats: 'Pantry',
  quinoa: 'Pantry',
  bread: 'Pantry',
  bun: 'Pantry',
  buns: 'Pantry',
  sourdough: 'Pantry',
  pasta: 'Pantry',
  macaroni: 'Pantry',
  spaghetti: 'Pantry',
  noodles: 'Pantry',
  maggi: 'Pantry',
  vermicelli: 'Pantry',
  semiya: 'Pantry',

  // Pulses & Dals
  dal: 'Pantry',
  daal: 'Pantry',
  pappu: 'Pantry',
  paruppu: 'Pantry',
  toordal: 'Pantry',
  tuvar: 'Pantry',
  tuvardal: 'Pantry',
  kandipappu: 'Pantry',
  moongdal: 'Pantry',
  pesarapappu: 'Pantry',
  chanadal: 'Pantry',
  chana: 'Pantry',
  chole: 'Pantry',
  uraddal: 'Pantry',
  minapappu: 'Pantry',
  masoordal: 'Pantry',
  rajma: 'Pantry',
  chickpeas: 'Pantry',
  lentils: 'Pantry',
  lobia: 'Pantry',
  alasandalu: 'Pantry',
  ulavalu: 'Pantry',
  kollu: 'Pantry',

  // Spices & Seasonings
  salt: 'Pantry',
  namak: 'Pantry',
  uppu: 'Pantry',
  sugar: 'Pantry',
  chini: 'Pantry',
  sakkare: 'Pantry',
  jaggery: 'Pantry',
  gud: 'Pantry',
  bellam: 'Pantry',
  vellam: 'Pantry',
  turmeric: 'Pantry',
  haldi: 'Pantry',
  pasupu: 'Pantry',
  manjal: 'Pantry',
  cumin: 'Pantry',
  jeera: 'Pantry',
  jeelakarra: 'Pantry',
  seeragam: 'Pantry',
  mustard: 'Pantry',
  rai: 'Pantry',
  sarson: 'Pantry',
  avalu: 'Pantry',
  kadugu: 'Pantry',
  dhania: 'Pantry',
  dhaniyalu: 'Pantry',
  cardamom: 'Pantry',
  elaichi: 'Pantry',
  yelakulu: 'Pantry',
  elakkai: 'Pantry',
  clove: 'Pantry',
  cloves: 'Pantry',
  laung: 'Pantry',
  lavangalu: 'Pantry',
  cinnamon: 'Pantry',
  dalchini: 'Pantry',
  dalchinachekka: 'Pantry',
  blackpepper: 'Pantry',
  kalimirch: 'Pantry',
  miriyalu: 'Pantry',
  hing: 'Pantry',
  asafoetida: 'Pantry',
  inguva: 'Pantry',
  perungayam: 'Pantry',
  tamarind: 'Pantry',
  imli: 'Pantry',
  chintapandu: 'Pantry',
  puli: 'Pantry',
  kasurimethi: 'Pantry',
  masala: 'Pantry',

  // Oils & Fats
  oil: 'Pantry',
  tel: 'Pantry',
  nune: 'Pantry',
  ennai: 'Pantry',

  // Dry Goods & Beverages
  tea: 'Pantry',
  chai: 'Pantry',
  coffee: 'Pantry',
  honey: 'Pantry',
  jam: 'Pantry',
  ketchup: 'Pantry',
  sauce: 'Pantry',
  vinegar: 'Pantry',
  mayonnaise: 'Pantry',
  biscuit: 'Pantry',
  biscuits: 'Pantry',
  cookies: 'Pantry',
  rusk: 'Pantry',
  papad: 'Pantry',
  appalam: 'Pantry',
  pickle: 'Pantry',
  achar: 'Pantry',
  pachadi: 'Pantry',
  almond: 'Pantry',
  almonds: 'Pantry',
  badam: 'Pantry',
  cashew: 'Pantry',
  cashews: 'Pantry',
  kaju: 'Pantry',
  jeedipappu: 'Pantry',
  walnut: 'Pantry',
  walnuts: 'Pantry',
  raisin: 'Pantry',
  raisins: 'Pantry',
  kismis: 'Pantry',
  pistachio: 'Pantry',
  pista: 'Pantry',
  peanut: 'Pantry',
  peanuts: 'Pantry',
  groundnut: 'Pantry',
  groundnuts: 'Pantry',
  moongphali: 'Pantry',
  pallilu: 'Pantry',

  // ================= MEAT & SEAFOOD =================
  chicken: 'Meat & Seafood',
  murgi: 'Meat & Seafood',
  kodi: 'Meat & Seafood',
  kozhi: 'Meat & Seafood',
  mutton: 'Meat & Seafood',
  lamb: 'Meat & Seafood',
  goat: 'Meat & Seafood',
  gosht: 'Meat & Seafood',
  meka: 'Meat & Seafood',
  aattukari: 'Meat & Seafood',
  beef: 'Meat & Seafood',
  pork: 'Meat & Seafood',
  bacon: 'Meat & Seafood',
  sausage: 'Meat & Seafood',
  sausages: 'Meat & Seafood',
  ham: 'Meat & Seafood',
  salami: 'Meat & Seafood',
  keema: 'Meat & Seafood',
  meat: 'Meat & Seafood',
  fish: 'Meat & Seafood',
  salmon: 'Meat & Seafood',
  tuna: 'Meat & Seafood',
  pomfret: 'Meat & Seafood',
  rohu: 'Meat & Seafood',
  catla: 'Meat & Seafood',
  katla: 'Meat & Seafood',
  tilapia: 'Meat & Seafood',
  bangda: 'Meat & Seafood',
  surmai: 'Meat & Seafood',
  machli: 'Meat & Seafood',
  chepa: 'Meat & Seafood',
  meen: 'Meat & Seafood',
  prawn: 'Meat & Seafood',
  prawns: 'Meat & Seafood',
  shrimp: 'Meat & Seafood',
  shrimps: 'Meat & Seafood',
  jheenga: 'Meat & Seafood',
  royyalu: 'Meat & Seafood',
  eral: 'Meat & Seafood',
  crab: 'Meat & Seafood',
  lobster: 'Meat & Seafood',
  squid: 'Meat & Seafood',
  egg: 'Meat & Seafood',
  eggs: 'Meat & Seafood',
  anda: 'Meat & Seafood',
  ande: 'Meat & Seafood',
  guddu: 'Meat & Seafood',
  gudlu: 'Meat & Seafood',
  muttai: 'Meat & Seafood',

  // ================= HOUSEHOLD =================
  soap: 'Household',
  soaps: 'Household',
  handwash: 'Household',
  bodywash: 'Household',
  shampoo: 'Household',
  conditioner: 'Household',
  toothpaste: 'Household',
  toothbrush: 'Household',
  mouthwash: 'Household',
  detergent: 'Household',
  surf: 'Household',
  surfexcel: 'Household',
  ariel: 'Household',
  tide: 'Household',
  rin: 'Household',
  comfort: 'Household',
  bleach: 'Household',
  vanish: 'Household',
  lizol: 'Household',
  harpic: 'Household',
  colin: 'Household',
  vim: 'Household',
  pril: 'Household',
  dettol: 'Household',
  lifebuoy: 'Household',
  sanitizer: 'Household',
  foil: 'Household',
  clingfilm: 'Household',
  napkin: 'Household',
  napkins: 'Household',
  tissue: 'Household',
  tissues: 'Household',
  toiletpaper: 'Household',
  papertowel: 'Household',
  papertowels: 'Household',
  broom: 'Household',
  mop: 'Household',
  wiper: 'Household',
  sponge: 'Household',
  scrubber: 'Household',
  dustbin: 'Household',
  battery: 'Household',
  batteries: 'Household',
  candle: 'Household',
  candles: 'Household',
  matchbox: 'Household',
  matches: 'Household',
  agarbatti: 'Household',
  incense: 'Household',
};

/**
 * Automatically classifies a grocery item name into the most appropriate category.
 * If the item cannot be confidently identified or matches conflicting categories,
 * returns { category: null, isAmbiguous: true, confidence: 'none' }.
 */
export function detectGroceryCategory(rawName: string): CategoryDetectionResult {
  if (!rawName || typeof rawName !== 'string') {
    return { category: null, confidence: 'none', isAmbiguous: false };
  }

  const normalized = normalizeItemName(rawName);
  if (!normalized) {
    return { category: null, confidence: 'none', isAmbiguous: false };
  }

  // 1. Check multi-word compound rules first (e.g. "coconut oil" -> Pantry vs "coconut" -> Produce)
  for (const rule of COMPOUND_RULES) {
    if (rule.pattern.test(rawName) || rule.pattern.test(normalized)) {
      return {
        category: rule.category,
        confidence: 'high',
        matchedKeyword: rule.keyword,
        isAmbiguous: false,
      };
    }
  }

  // 2. Direct exact match in dictionary
  const directMatch = GROCERY_DICTIONARY[normalized];
  if (directMatch) {
    return {
      category: directMatch,
      confidence: 'high',
      matchedKeyword: normalized,
      isAmbiguous: false,
    };
  }

  // Direct without spaces (e.g. "curryleaves", "frenchbeans")
  const noSpace = normalized.replace(/\s+/g, '');
  const noSpaceMatch = GROCERY_DICTIONARY[noSpace];
  if (noSpaceMatch) {
    return {
      category: noSpaceMatch,
      confidence: 'high',
      matchedKeyword: noSpace,
      isAmbiguous: false,
    };
  }

  // 3. Tokenize words and find matches
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const matchedCategories = new Set<CategoryType>();
  let bestKeyword: string | undefined;

  for (const token of tokens) {
    // Check dictionary for single token
    const cat = GROCERY_DICTIONARY[token];
    if (cat) {
      matchedCategories.add(cat);
      if (!bestKeyword) bestKeyword = token;
      continue;
    }

    // Singularization fallback (e.g. "carrots" -> "carrot", "apples" -> "apple", "tomatoes" -> "tomato")
    if (token.endsWith('es')) {
      const singularEs = token.slice(0, -2);
      const catEs = GROCERY_DICTIONARY[singularEs];
      if (catEs) {
        matchedCategories.add(catEs);
        if (!bestKeyword) bestKeyword = singularEs;
        continue;
      }
    }
    if (token.endsWith('s') && !token.endsWith('ss')) {
      const singular = token.slice(0, -1);
      const catS = GROCERY_DICTIONARY[singular];
      if (catS) {
        matchedCategories.add(catS);
        if (!bestKeyword) bestKeyword = singular;
        continue;
      }
    }
  }

  // 4. Evaluate matched categories
  if (matchedCategories.size === 1) {
    const [singleCategory] = Array.from(matchedCategories);
    return {
      category: singleCategory,
      confidence: 'medium',
      matchedKeyword: bestKeyword,
      isAmbiguous: false,
    };
  }

  if (matchedCategories.size > 1) {
    // Conflict between multiple distinct categories (e.g. "chicken and cheese pizza" -> Meat & Seafood vs Dairy)
    return {
      category: null,
      confidence: 'low',
      isAmbiguous: true,
      candidateCategories: Array.from(matchedCategories),
      matchedKeyword: bestKeyword,
    };
  }

  // 5. Substring search in dictionary keys if token length >= 4
  const candidateMatches = new Set<CategoryType>();
  let subKeyword: string | undefined;

  for (const token of tokens) {
    if (token.length < 4) continue;
    for (const [key, cat] of Object.entries(GROCERY_DICTIONARY)) {
      if (key.length >= 4 && (token.includes(key) || key.includes(token))) {
        candidateMatches.add(cat);
        if (!subKeyword) subKeyword = key;
      }
    }
  }

  if (candidateMatches.size === 1) {
    const [subCat] = Array.from(candidateMatches);
    return {
      category: subCat,
      confidence: 'medium',
      matchedKeyword: subKeyword,
      isAmbiguous: false,
    };
  }

  if (candidateMatches.size > 1) {
    return {
      category: null,
      confidence: 'low',
      isAmbiguous: true,
      candidateCategories: Array.from(candidateMatches),
      matchedKeyword: subKeyword,
    };
  }

  // No confident match
  return {
    category: null,
    confidence: 'none',
    isAmbiguous: false,
  };
}
