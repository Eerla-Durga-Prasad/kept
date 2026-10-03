import React, { useState } from 'react';
import { Recipe, RecipeIngredient } from '../sync/types';
import { Clock, Users, Flame, Check, Plus, ShoppingBag, ArrowLeft, Share2 } from 'lucide-react';
import { fireOrganicParticles } from '../lib/utils';

interface RecipeDetailProps {
  recipe: Recipe;
  onBack?: () => void;
  onAddIngredientToList: (name: string, quantity: string) => void;
  onAddAllIngredientsToList: (ingredients: RecipeIngredient[]) => void;
}

export const RecipeDetail: React.FC<RecipeDetailProps> = ({
  recipe,
  onBack,
  onAddIngredientToList,
  onAddAllIngredientsToList,
}) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [addedIngredients, setAddedIngredients] = useState<Record<string, boolean>>({});
  const [allAdded, setAllAdded] = useState(false);

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
    onAddIngredientToList(ing.name, ing.quantity);
    setAddedIngredients((prev) => ({ ...prev, [idx]: true }));
    setTimeout(() => {
      setAddedIngredients((prev) => ({ ...prev, [idx]: false }));
    }, 2000);
  };

  const handleAddAll = () => {
    onAddAllIngredientsToList(recipe.ingredients);
    setAllAdded(true);
    setTimeout(() => setAllAdded(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto pb-16 animate-fadeIn">
      {/* Navigation back */}
      {onBack && (
        <div className="mb-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-medium text-ink-600 hover:text-ink-900 transition-colors py-1 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to recipes</span>
          </button>
        </div>
      )}

      {/* Large food photograph at top */}
      <div className="relative w-full h-80 sm:h-96 rounded-2xl overflow-hidden border border-borderWarm shadow-card mb-8">
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 via-transparent to-black/20" />

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            className="p-2.5 rounded-full bg-white/80 backdrop-blur-md text-ink-800 hover:bg-white transition-colors"
            title="Share recipe"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute bottom-6 left-6 right-6 text-white">
          <span className="text-xs uppercase tracking-widest font-medium text-terracotta-200">
            {recipe.category}
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight mt-1 drop-shadow-md">
            {recipe.title}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata badges */}
          <div className="flex items-center gap-6 py-3 border-y border-borderWarm text-xs text-ink-700">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-terracotta-500" />
              <span>{recipe.prep_time}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-botanical-600" />
              <span>{recipe.serves}</span>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-terracotta-500" />
              <span>{recipe.difficulty}</span>
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
                  <li key={idx} className="flex gap-4 text-sm text-ink-700 leading-relaxed">
                    <span className="w-6 h-6 rounded-full bg-cream-200 text-ink-700 font-serif text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Right Ingredients Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-borderWarm p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-borderWarm-subtle">
              <h3 className="font-serif text-xl font-medium text-ink-900">
                Ingredients
              </h3>
              <span className="text-xs text-ink-400">
                {recipe.ingredients.length} items
              </span>
            </div>

            {/* Ingredients with checkbox + Add to list */}
            <div className="divide-y divide-borderWarm-subtle/60">
              {recipe.ingredients.map((ing, idx) => {
                const isChecked = Boolean(checkedIngredients[idx]);
                const isAdded = Boolean(addedIngredients[idx]);

                return (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => toggleCheck(idx, e)}
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-botanical-600 border-botanical-600 text-white'
                            : 'border-borderWarm-dark hover:border-botanical-500'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[2.5]" />}
                      </button>
                      <div className="min-w-0">
                        <span className={`text-sm font-medium ${isChecked ? 'line-through text-ink-400' : 'text-ink-900'}`}>
                          {ing.name}
                        </span>
                        <span className="text-xs text-ink-500 ml-1.5 font-normal">
                          — {ing.quantity}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSingle(ing, idx)}
                      title="Add to grocery list"
                      className="text-xs px-2 py-1 rounded text-ink-500 hover:text-terracotta-600 hover:bg-terracotta-50 flex items-center gap-1 transition-colors"
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3 h-3 text-botanical-600" />
                          <span className="text-[11px] text-botanical-600">Added</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          <span className="text-[11px]">Add</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom action: Add all to grocery list */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleAddAll}
                className="w-full py-2.5 px-4 bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-medium rounded-lg shadow-subtle flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {allAdded ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>All ingredients added to list!</span>
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
