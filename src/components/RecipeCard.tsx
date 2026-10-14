import React, { useState } from 'react';
import { RecipeIngredient, Item } from '../sync/types';
import { ExtendedRecipe } from '../data/recipeCatalog';
import {
  Clock,
  Users,
  Flame,
  Check,
  Plus,
  ShoppingBag,
  ArrowLeft,
  Minus,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { fireOrganicParticles } from '../lib/utils';
import { SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';

interface RecipeCardProps {
  recipe: ExtendedRecipe;
  onClick: () => void;
  className?: string;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onClick, className = '' }) => {
  const [imgSrc, setImgSrc] = useState(recipe.image_url);
  const [hasError, setHasError] = useState(false);

  const handleImageError = () => {
    if (imgSrc !== SAFE_FALLBACK_FOOD_IMAGE) {
      setImgSrc(SAFE_FALLBACK_FOOD_IMAGE);
    } else {
      setHasError(true);
    }
  };

  const isVeg = recipe.diet === 'Vegetarian' || recipe.diet === 'Vegan';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group bg-white rounded-2xl border border-borderWarm overflow-hidden shadow-card hover:shadow-float hover:border-terracotta-300 transition-all duration-300 cursor-pointer flex flex-col w-full text-left focus:outline-none focus:ring-2 focus:ring-terracotta-400 ${className}`}
    >
      <div className="aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden relative bg-cream-100 shrink-0">
        {!hasError ? (
          <img
            src={imgSrc}
            alt={recipe.title}
            loading="lazy"
            onError={handleImageError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-cream-200/60 text-ink-400">
            <UtensilsCrossed className="w-8 h-8 text-terracotta-400/80 mb-2 stroke-[1.5]" />
            <span className="text-xs font-serif italic text-ink-600 text-center line-clamp-1">{recipe.title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/65 via-ink-900/10 to-black/10 pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 flex items-center justify-between gap-1.5 pointer-events-none">
          <span className="px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-white/95 backdrop-blur-md text-ink-800 shadow-subtle border border-borderWarm-subtle max-w-[60%] truncate">
            {recipe.category}
          </span>
          {recipe.diet && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 backdrop-blur-md border shrink-0 ${
                isVeg
                  ? 'bg-botanical-50/95 text-botanical-700 border-botanical-200'
                  : 'bg-red-50/95 text-red-700 border-red-200'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-botanical-600' : 'bg-red-600'}`} />
              <span className="whitespace-nowrap">{recipe.diet}</span>
            </span>
          )}
        </div>

        {/* Prep Time pill on bottom of image */}
        <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-ink-900/75 backdrop-blur-sm text-cream-100 text-[11px] font-medium pointer-events-none shadow-sm">
          <Clock className="w-3 h-3 text-terracotta-300 shrink-0" />
          <span>{recipe.prep_time}</span>
        </div>
      </div>

      <div className="p-3.5 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-serif text-base sm:text-lg font-medium text-ink-900 group-hover:text-terracotta-600 transition-colors line-clamp-2 leading-snug min-h-[2.6rem]">
            {recipe.title}
          </h3>
          <p className="text-xs text-ink-600 mt-1.5 line-clamp-2 leading-relaxed font-normal">
            {recipe.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 mt-3 sm:pt-3.5 sm:mt-3.5 border-t border-borderWarm-subtle text-xs text-ink-500">
          <div className="flex items-center gap-1.5 shrink-0 text-ink-600 font-medium">
            <Users className="w-3.5 h-3.5 text-botanical-600 shrink-0" />
            <span>{recipe.serves}</span>
          </div>
          {recipe.cuisine && (
            <span className="text-[11px] text-ink-500 truncate max-w-[110px] hidden sm:inline">
              {recipe.cuisine}
            </span>
          )}
          <span className="font-medium text-ink-700 px-2 py-0.5 rounded bg-cream-100 text-[11px] shrink-0 border border-borderWarm-subtle/80">
            {recipe.difficulty}
          </span>
        </div>
      </div>
    </div>
  );
};

interface RecipeDetailProps {
  recipe: ExtendedRecipe;
  onBack?: () => void;
  onAddIngredientToList: (name: string, quantity: string) => void;
  onAddAllIngredientsToList: (ingredients: RecipeIngredient[]) => void;
  existingItems?: Item[];
}

function scaleQuantity(quantityStr: string, baseServings: number, currentServings: number): string {
  if (baseServings <= 0 || currentServings <= 0 || baseServings === currentServings) {
    return quantityStr;
  }
  const ratio = currentServings / baseServings;

  const fractionMatch = quantityStr.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fractionMatch) {
    const num = parseInt(fractionMatch[1], 10);
    const den = parseInt(fractionMatch[2], 10);
    const scaled = (num / den) * ratio;
    const rest = fractionMatch[3] ? ` ${fractionMatch[3]}` : '';
    return `${formatScaledNumber(scaled)}${rest}`;
  }

  const numMatch = quantityStr.match(/^([\d.]+)\s*(.*)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    const scaled = num * ratio;
    const rest = numMatch[2] ? ` ${numMatch[2]}` : '';
    return `${formatScaledNumber(scaled)}${rest}`;
  }

  return quantityStr;
}

function formatScaledNumber(num: number): string {
  if (Math.abs(num - 0.25) < 0.05) return '1/4';
  if (Math.abs(num - 0.33) < 0.05) return '1/3';
  if (Math.abs(num - 0.5) < 0.05) return '1/2';
  if (Math.abs(num - 0.66) < 0.05) return '2/3';
  if (Math.abs(num - 0.75) < 0.05) return '3/4';
  if (num % 1 === 0) return num.toString();
  return num.toFixed(1).replace(/\.0$/, '');
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({
  recipe,
  onBack,
  onAddIngredientToList,
  onAddAllIngredientsToList,
  existingItems = [],
}) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [addedIngredients, setAddedIngredients] = useState<Record<string, boolean>>({});
  const [allAdded, setAllAdded] = useState(false);
  const [imgSrc, setImgSrc] = useState(recipe.image_url);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic servings scaler
  const baseServings = recipe.servings_count || 4;
  const [currentServings, setCurrentServings] = useState<number>(baseServings);

  const handleImageError = () => {
    if (imgSrc !== SAFE_FALLBACK_FOOD_IMAGE) {
      setImgSrc(SAFE_FALLBACK_FOOD_IMAGE);
    }
  };

  const toggleCheck = (idx: number, e: React.MouseEvent) => {
    const isNowChecked = !checkedIngredients[idx];
    setCheckedIngredients((prev) => ({ ...prev, [idx]: isNowChecked }));

    if (isNowChecked) {
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
      const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
      fireOrganicParticles(xRatio, yRatio);
    }
  };

  const handleAddSingle = (ing: RecipeIngredient, idx: number) => {
    const scaledQty = scaleQuantity(ing.quantity, baseServings, currentServings);
    onAddIngredientToList(ing.name, scaledQty);
    setAddedIngredients((prev) => ({ ...prev, [idx]: true }));
    setTimeout(() => {
      setAddedIngredients((prev) => ({ ...prev, [idx]: false }));
    }, 2000);
  };

  const handleAddAll = () => {
    // Scale ingredients and filter duplicates if already in list
    const scaledIngredients = recipe.ingredients.map((ing) => ({
      ...ing,
      quantity: scaleQuantity(ing.quantity, baseServings, currentServings),
    }));

    // Find if any ingredients already exist in current grocery items
    const existingNames = new Set(existingItems.map((item) => item.name.toLowerCase().trim()));
    const newIngredients = scaledIngredients.filter(
      (ing) => !existingNames.has(ing.name.toLowerCase().trim())
    );

    if (newIngredients.length === 0 && scaledIngredients.length > 0) {
      // All were already present, add anyway or notify
      onAddAllIngredientsToList(scaledIngredients);
      setToastMessage('All recipe ingredients already present in your list.');
    } else {
      onAddAllIngredientsToList(scaledIngredients);
      setToastMessage(
        newIngredients.length < scaledIngredients.length
          ? `Added ${newIngredients.length} new ingredient(s); ${scaledIngredients.length - newIngredients.length} already in pantry!`
          : `Added all ${scaledIngredients.length} ingredients to your grocery list!`
      );
    }

    setAllAdded(true);
    setTimeout(() => {
      setAllAdded(false);
      setToastMessage(null);
    }, 3500);
  };

  const isVeg = recipe.diet === 'Vegetarian' || recipe.diet === 'Vegan';

  return (
    <div className="max-w-4xl mx-auto pb-16 animate-fadeIn px-0 sm:px-2">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-ink-900 text-cream-50 px-4 py-3 rounded-xl shadow-float text-xs font-medium flex items-center gap-2 border border-borderWarm animate-fadeIn">
          <Sparkles className="w-4 h-4 text-terracotta-400 shrink-0" />
          <span className="leading-snug">{toastMessage}</span>
        </div>
      )}

      {/* Navigation back */}
      {onBack && (
        <div className="mb-3 sm:mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-600 hover:text-ink-900 transition-colors py-2 px-1 cursor-pointer min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4 text-terracotta-500 shrink-0" />
            <span>Back to recipes</span>
          </button>
        </div>
      )}

      {/* Large food photograph at top */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-2xl overflow-hidden border border-borderWarm shadow-card mb-6 sm:mb-8 bg-cream-100">
        <img
          src={imgSrc}
          alt={recipe.title}
          onError={handleImageError}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/35 to-black/20" />

        <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 flex items-center gap-2">
          {recipe.diet && (
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-md shadow-subtle border ${
                isVeg
                  ? 'bg-botanical-50/95 text-botanical-700 border-botanical-200'
                  : 'bg-red-50/95 text-red-700 border-red-200'
              }`}
            >
              {recipe.diet}
            </span>
          )}
        </div>

        <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] sm:text-xs uppercase tracking-widest font-semibold text-terracotta-300">
              {recipe.category}
            </span>
            {recipe.cuisine && (
              <>
                <span className="text-white/40">•</span>
                <span className="text-[11px] sm:text-xs font-medium text-cream-200">{recipe.cuisine}</span>
              </>
            )}
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight mt-1 drop-shadow-md leading-tight">
            {recipe.title}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata badges: 2-col on mobile, flex row on sm+ */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 sm:gap-6 py-3 px-3.5 sm:px-4 border-y border-borderWarm text-xs text-ink-700 bg-white/70 rounded-xl">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-terracotta-500 shrink-0" />
              <span className="truncate">Prep: {recipe.prep_time}</span>
            </div>
            {recipe.cook_time && (
              <div className="flex items-center gap-2 min-w-0">
                <UtensilsCrossed className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">Cook: {recipe.cook_time}</span>
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0">
              <Users className="w-4 h-4 text-botanical-600 shrink-0" />
              <span className="truncate">{recipe.serves}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="w-4 h-4 text-terracotta-500 shrink-0" />
              <span className="truncate">{recipe.difficulty}</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-serif text-xl font-medium text-ink-900 mb-2">
              About this recipe
            </h3>
            <p className="text-sm text-ink-600 leading-relaxed font-normal">
              {recipe.description}
            </p>
          </div>

          {/* Cooking Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div className="pt-2">
              <h3 className="font-serif text-xl font-medium text-ink-900 mb-4">
                Method
              </h3>
              <ol className="space-y-4">
                {recipe.instructions.map((step, idx) => (
                  <li
                    key={idx}
                    className="flex gap-4 text-sm text-ink-700 leading-relaxed bg-white p-4 rounded-xl border border-borderWarm"
                  >
                    <span className="w-7 h-7 rounded-full bg-cream-200 border border-borderWarm text-ink-800 font-serif text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="flex-1 pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Right Ingredients Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-borderWarm p-4 sm:p-6 shadow-card space-y-4">
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pb-3 border-b border-borderWarm-subtle">
              <div>
                <h3 className="font-serif text-lg sm:text-xl font-medium text-ink-900">
                  Ingredients
                </h3>
                <span className="text-xs text-ink-400">
                  {recipe.ingredients.length} items
                </span>
              </div>

              {/* Servings scaler */}
              <div className="flex items-center gap-1.5 bg-cream-100 px-2 py-1 rounded-xl border border-borderWarm shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrentServings((s) => Math.max(1, s - 1))}
                  disabled={currentServings <= 1}
                  className="p-1.5 text-ink-600 hover:text-ink-900 disabled:opacity-30 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-cream-200 transition-colors"
                  title="Decrease servings"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-semibold text-ink-800 min-w-[54px] text-center">
                  {currentServings} servings
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentServings((s) => Math.min(16, s + 1))}
                  disabled={currentServings >= 16}
                  className="p-1.5 text-ink-600 hover:text-ink-900 disabled:opacity-30 cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-cream-200 transition-colors"
                  title="Increase servings"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Ingredients with checkbox + Add to list */}
            <div className="divide-y divide-borderWarm-subtle/60 max-h-[460px] overflow-y-auto pr-1">
              {recipe.ingredients.map((ing, idx) => {
                const isChecked = Boolean(checkedIngredients[idx]);
                const isAdded = Boolean(addedIngredients[idx]);
                const scaledQty = scaleQuantity(ing.quantity, baseServings, currentServings);
                const isAlreadyInList = existingItems.some(
                  (item) => item.name.toLowerCase().trim() === ing.name.toLowerCase().trim()
                );

                return (
                  <div key={idx} className="py-2.5 sm:py-3 flex items-center justify-between gap-2.5 group">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => toggleCheck(idx, e)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isChecked
                            ? 'bg-botanical-600 border-botanical-600 text-white'
                            : 'border-borderWarm-dark hover:border-botanical-500'
                        }`}
                        title={isChecked ? 'Mark unneeded' : 'Mark needed'}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </button>
                      <div className="min-w-0 leading-tight">
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            isChecked ? 'line-through text-ink-400' : 'text-ink-900'
                          } break-words`}
                        >
                          {ing.name}
                        </span>
                        <span className="text-xs text-ink-500 ml-1.5 font-normal">
                          — {scaledQty}
                        </span>
                        {isAlreadyInList && (
                          <span className="inline-block mt-0.5 sm:mt-0 sm:ml-2 text-[10px] text-botanical-700 bg-botanical-50 px-1.5 py-0.5 rounded font-medium border border-botanical-200">
                            in pantry
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSingle(ing, idx)}
                      title="Add to grocery list"
                      className="text-xs px-2.5 py-1.5 rounded-lg text-ink-600 hover:text-terracotta-600 hover:bg-terracotta-50 flex items-center gap-1 transition-colors cursor-pointer shrink-0 min-h-[36px]"
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-botanical-600" />
                          <span className="text-[11px] font-medium text-botanical-600">Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium">Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom action: Add all to grocery list */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddAll}
                className="w-full min-h-[44px] py-3 px-4 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white text-xs sm:text-sm font-medium rounded-xl shadow-subtle flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {allAdded ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Added to Grocery List!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Add all to grocery list</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
