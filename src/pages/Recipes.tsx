import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe, RecipeIngredient, Item } from '../sync/types';
import { RecipeCard, RecipeDetail } from '../components/RecipeCard';
import { ExtendedRecipe, COMPREHENSIVE_RECIPES } from '../data/recipeCatalog';
import { searchRecipes, getRecipeSuggestions } from '../lib/recipeSearch';
import {
  Clock,
  Users,
  Flame,
  Search,
  X,
  Sparkles,
  ChevronRight,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

interface RecipesProps {
  recipes: Recipe[];
  items?: Item[];
  onAddIngredientToList: (name: string, quantity: string) => void;
  onAddAllIngredientsToList: (ingredients: RecipeIngredient[]) => void;
}

const CUISINE_FILTERS = [
  'All',
  'South Indian',
  'Andhra & Telangana',
  'North Indian',
  'Breakfast',
  'Curries',
  'Rice Dishes',
  'Desserts',
  'International',
] as const;

export const Recipes: React.FC<RecipesProps> = ({
  recipes,
  items = [],
  onAddIngredientToList,
  onAddAllIngredientsToList,
}) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [activeDiet, setActiveDiet] = useState<'All' | 'Vegetarian' | 'Non-Vegetarian'>('All');
  const [quickOnly, setQuickOnly] = useState(false);

  // Search execution state
  const [searchResults, setSearchResults] = useState<ExtendedRecipe[]>([]);
  const [correctedTerm, setCorrectedTerm] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Autocomplete suggestions as user types
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const sugg = getRecipeSuggestions(searchQuery, COMPREHENSIVE_RECIPES);
      setSuggestions(sugg);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Run search whenever debounced query or facets change
  useEffect(() => {
    let isCancelled = false;

    const performSearch = async () => {
      setIsSearching(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const cuisineOption =
          activeFilter === 'South Indian' || activeFilter === 'Andhra & Telangana' || activeFilter === 'North Indian' || activeFilter === 'International'
            ? activeFilter
            : undefined;

        const categoryOption =
          activeFilter === 'Breakfast' || activeFilter === 'Curries' || activeFilter === 'Rice Dishes' || activeFilter === 'Desserts'
            ? activeFilter
            : undefined;

        const res = await searchRecipes(debouncedQuery, recipes, {
          cuisine: cuisineOption,
          category: categoryOption,
          diet: activeDiet !== 'All' ? activeDiet : undefined,
          quickOnly,
          includeExternal: true,
          abortSignal: abortController.signal,
        });

        if (!isCancelled) {
          setSearchResults(res.results);
          setCorrectedTerm(res.correctedTerm);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          // If aborted, keep previous
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    };

    performSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, activeFilter, activeDiet, quickOnly, recipes]);

  // Merge all known recipes to resolve the selected one
  const allKnownRecipes = useMemo(() => {
    const map = new Map<string, ExtendedRecipe>();
    for (const r of recipes) map.set(r.id, r as ExtendedRecipe);
    for (const r of COMPREHENSIVE_RECIPES) if (!map.has(r.id)) map.set(r.id, r);
    for (const r of searchResults) if (!map.has(r.id)) map.set(r.id, r);
    return Array.from(map.values());
  }, [recipes, searchResults]);

  const selectedRecipe = allKnownRecipes.find((r) => r.id === selectedRecipeId);

  // If a recipe is selected, show detail view
  if (selectedRecipe) {
    return (
      <div className="px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6">
        <RecipeDetail
          recipe={selectedRecipe}
          existingItems={items}
          onBack={() => setSelectedRecipeId(null)}
          onAddIngredientToList={onAddIngredientToList}
          onAddAllIngredientsToList={onAddAllIngredientsToList}
        />
      </div>
    );
  }

  // Featured Hero Recipe (defaults to Masala Dosa or Paneer Butter Masala)
  const featuredRecipe =
    allKnownRecipes.find((r) => r.id === 'rec_masala_dosa') ||
    allKnownRecipes.find((r) => r.id === 'rec_paneer_butter_masala') ||
    allKnownRecipes[0];

  // Curated collections for discovery mode
  const popularFavorites = allKnownRecipes.filter((r) =>
    ['rec_paneer_butter_masala', 'rec_hyderabadi_biryani', 'rec_masala_dosa'].includes(r.id)
  );

  const southIndianClassics = allKnownRecipes.filter((r) =>
    r.cuisine === 'South Indian' || r.cuisine === 'Andhra & Telangana'
  ).slice(0, 4);

  const quickWeeknightMeals = allKnownRecipes.filter((r) => {
    const t = parseInt(r.prep_time || '0', 10);
    return t > 0 && t <= 20;
  }).slice(0, 4);

  const sweetTreats = allKnownRecipes.filter((r) => r.category === 'Desserts');

  const isFilterActive = activeFilter !== 'All' || activeDiet !== 'All' || quickOnly;
  const isSearchMode = debouncedQuery.trim().length > 0 || isFilterActive;

  const handleSelectSuggestion = (sugg: string) => {
    setSearchQuery(sugg);
    setDebouncedQuery(sugg);
    setShowSuggestions(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveFilter('All');
    setActiveDiet('All');
    setQuickOnly(false);
    setShowSuggestions(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 animate-fadeIn w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-5 pb-5 sm:pb-6 mb-5 sm:mb-6 border-b border-borderWarm">
        <div>
          <h1 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900 leading-tight">
            Recipes & Kitchen
          </h1>
          <p className="font-serif italic text-xs sm:text-base text-ink-600 mt-1 sm:mt-1.5 font-normal">
            Cookbook favorites, regional heirlooms, and weeknight family staples.
          </p>
        </div>

        {/* Smart Search Bar */}
        <div ref={searchContainerRef} className="relative w-full md:w-80 lg:w-96">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowSuggestions(false);
                }
              }}
              placeholder="Search dishes, ingredients, or cuisines..."
              className="w-full pl-9 pr-9 py-2.5 sm:py-3 bg-white border border-borderWarm rounded-xl text-xs sm:text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-terracotta-500 shadow-subtle transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-1.5 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : isSearching ? (
              <RefreshCw className="w-3.5 h-3.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-terracotta-500 animate-spin" />
            ) : null}
          </div>

          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-borderWarm shadow-float z-30 overflow-hidden divide-y divide-borderWarm-subtle animate-fadeIn max-h-60 overflow-y-auto">
              {suggestions.map((sugg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(sugg)}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-ink-800 hover:bg-cream-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium truncate pr-2">{sugg}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-ink-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Facet Bar */}
      <div className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none text-xs -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          {CUISINE_FILTERS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveFilter(cat)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all cursor-pointer border text-xs shrink-0 ${
                activeFilter === cat
                  ? 'bg-terracotta-500 text-white border-terracotta-500 shadow-subtle'
                  : 'bg-white text-ink-700 border-borderWarm hover:border-terracotta-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dietary and Quick filters - WRAPS cleanly on small screens without page overflow */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs text-ink-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 shrink-0">Diet:</span>
            {(['All', 'Vegetarian', 'Non-Vegetarian'] as const).map((diet) => (
              <button
                key={diet}
                type="button"
                onClick={() => setActiveDiet(diet)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border shrink-0 ${
                  activeDiet === diet
                    ? 'bg-cream-200 border-borderWarm-dark text-ink-900 font-semibold'
                    : 'bg-white border-borderWarm-subtle text-ink-600 hover:text-ink-900'
                }`}
              >
                {diet}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setQuickOnly(!quickOnly)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1.5 shrink-0 ${
                quickOnly
                  ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                  : 'bg-white border-borderWarm-subtle text-ink-600 hover:text-ink-900'
              }`}
            >
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Under 25 mins</span>
            </button>
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium cursor-pointer shrink-0 py-1"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Typo Correction Banner */}
      {correctedTerm && (
        <div className="mb-6 p-3.5 bg-cream-100 border border-terracotta-200 rounded-xl flex items-center justify-between gap-3 text-xs text-ink-800 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-terracotta-500 shrink-0" />
            <span>
              Showing results for <strong className="font-semibold text-terracotta-600 capitalize">{correctedTerm}</strong>{' '}
              <span className="text-ink-500">(searched for "{searchQuery}")</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCorrectedTerm(null)}
            className="text-[11px] text-ink-500 hover:text-ink-800 underline shrink-0 cursor-pointer"
          >
            Search literal term
          </button>
        </div>
      )}

      {/* DISCOVERY MODE (when no search query or active filter) */}
      {!isSearchMode && (
        <>
          {/* Featured Recipe Hero Card */}
          {featuredRecipe && (
            <div
              onClick={() => setSelectedRecipeId(featuredRecipe.id)}
              className="group relative w-full min-h-[300px] sm:h-96 rounded-2xl overflow-hidden border border-borderWarm shadow-card mb-8 sm:mb-10 cursor-pointer transition-all hover:shadow-float bg-cream-100 flex flex-col justify-end"
            >
              <img
                src={featuredRecipe.image_url}
                alt={featuredRecipe.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/50 to-transparent pointer-events-none" />

              <div className="relative p-4 sm:p-7 text-white">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold px-2.5 py-1 rounded bg-terracotta-500 text-white inline-block mb-1.5 sm:mb-2 shadow-subtle">
                  Featured Kitchen Heirloom
                </span>
                <h2 className="font-serif text-xl sm:text-3xl lg:text-4xl font-medium tracking-tight drop-shadow-md leading-tight">
                  {featuredRecipe.title}
                </h2>
                <p className="text-xs sm:text-sm text-cream-200 mt-1 max-w-xl line-clamp-2 leading-relaxed font-normal">
                  {featuredRecipe.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 sm:mt-4 text-xs text-cream-300">
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-terracotta-300 shrink-0" /> {featuredRecipe.prep_time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-botanical-300 shrink-0" /> {featuredRecipe.serves}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" /> {featuredRecipe.difficulty}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg group-hover:bg-terracotta-500 transition-colors shrink-0">
                    <span>View Recipe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Popular Favorites */}
          <div className="mb-8 sm:mb-10 space-y-3.5 sm:space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-medium text-ink-900 tracking-tight">
                  Popular Favorites
                </h2>
                <p className="text-xs text-ink-500">Most requested dishes across family kitchens</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {popularFavorites.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipeId(recipe.id)} />
              ))}
            </div>
          </div>

          {/* Section 2: South Indian & Andhra Classics */}
          <div className="mb-8 sm:mb-10 space-y-3.5 sm:space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-medium text-ink-900 tracking-tight">
                  South Indian & Andhra Classics
                </h2>
                <p className="text-xs text-ink-500">Crispy dosas, fluffy idlis, pulihora, and spicy kodi kura</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveFilter('South Indian')}
                className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1 cursor-pointer shrink-0 pt-0.5"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {southIndianClassics.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipeId(recipe.id)} />
              ))}
            </div>
          </div>

          {/* Section 3: Quick Weeknight Meals */}
          <div className="mb-8 sm:mb-10 space-y-3.5 sm:space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-medium text-ink-900 tracking-tight">
                  Quick Weeknight Meals
                </h2>
                <p className="text-xs text-ink-500">Delicious, nourishing dinners in under 25 minutes</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickOnly(true)}
                className="text-xs font-medium text-terracotta-600 hover:text-terracotta-700 flex items-center gap-1 cursor-pointer shrink-0 pt-0.5"
              >
                <span>View fast meals</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {quickWeeknightMeals.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipeId(recipe.id)} />
              ))}
            </div>
          </div>

          {/* Section 4: Sweet Celebrations */}
          {sweetTreats.length > 0 && (
            <div className="mb-8 sm:mb-10 space-y-3.5 sm:space-y-4">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-medium text-ink-900 tracking-tight">
                  Festive Sweets & Desserts
                </h2>
                <p className="text-xs text-ink-500">Traditional celebrations and after-dinner delicacies</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {sweetTreats.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipeId(recipe.id)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* SEARCH / FILTERED RESULTS MODE */}
      {isSearchMode && (
        <div className="space-y-5 sm:space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-borderWarm-subtle">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-medium text-ink-900">
                {searchQuery ? `Search Results (${searchResults.length})` : `Filtered Recipes (${searchResults.length})`}
              </h2>
              {searchQuery && (
                <p className="text-xs text-ink-500">
                  Showing matching recipes for "{searchQuery}"
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-xs text-ink-500 hover:text-ink-800 underline cursor-pointer"
            >
              Clear search & filters
            </button>
          </div>

          {searchResults.length > 0 ? (
            <div className="recipe-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {searchResults.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipeId(recipe.id)} />
              ))}
            </div>
          ) : (
            /* Empty State with Recommended Fallback */
            <div className="space-y-6 sm:space-y-8 py-6 sm:py-8">
              <div className="bg-white rounded-2xl border border-borderWarm p-6 sm:p-8 text-center max-w-xl mx-auto shadow-card space-y-3">
                <div className="w-12 h-12 rounded-full bg-cream-200 text-ink-500 mx-auto flex items-center justify-center">
                  <Search className="w-6 h-6 text-terracotta-500" />
                </div>
                <h3 className="font-serif text-lg sm:text-xl font-medium text-ink-900">
                  No recipes found for "{searchQuery}"
                </h3>
                <p className="text-xs sm:text-sm text-ink-600 leading-relaxed max-w-md mx-auto">
                  We couldn't find an exact match for your search. Try adjusting the spelling, clearing filters, or explore these popular favorites below:
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="min-h-[40px] px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    View All Recipes
                  </button>
                </div>
              </div>

              {/* Recommended alternatives */}
              <div className="space-y-3.5 sm:space-y-4">
                <h3 className="font-serif text-lg sm:text-xl font-medium text-ink-900">
                  Recommended Dishes You Might Enjoy
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {COMPREHENSIVE_RECIPES.slice(0, 3).map((recipe) => (
                    <RecipeCard key={recipe.id} recipe={recipe} onClick={() => setSelectedRecipeId(recipe.id)} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
