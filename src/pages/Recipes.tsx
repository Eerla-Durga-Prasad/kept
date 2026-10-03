import React, { useState } from 'react';
import { Recipe, RecipeIngredient } from '../sync/types';
import { RecipeDetail } from '../components/RecipeCard';
import { Clock, Users, Flame, Search } from 'lucide-react';

interface RecipesProps {
  recipes: Recipe[];
  onAddIngredientToList: (name: string, quantity: string) => void;
  onAddAllIngredientsToList: (ingredients: RecipeIngredient[]) => void;
}

export const Recipes: React.FC<RecipesProps> = ({
  recipes,
  onAddIngredientToList,
  onAddAllIngredientsToList,
}) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedRecipe = recipes.find((r) => r.id === selectedRecipeId);

  if (selectedRecipe) {
    return (
      <div className="px-4 sm:px-8 py-6">
        <RecipeDetail
          recipe={selectedRecipe}
          onBack={() => setSelectedRecipeId(null)}
          onAddIngredientToList={onAddIngredientToList}
          onAddAllIngredientsToList={onAddAllIngredientsToList}
        />
      </div>
    );
  }

  const filtered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 mb-8 border-b border-borderWarm">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
            Recipes
          </h1>
          <p className="font-serif italic text-sm sm:text-base text-ink-600 mt-1.5 font-normal">
            Cookbook favorites, family heirlooms, and weeknight staples.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-borderWarm rounded-xl text-xs sm:text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-terracotta-500 shadow-subtle"
          />
        </div>
      </div>

      {/* Featured Recipe Card (Paneer Butter Masala) */}
      {recipes[0] && (
        <div
          onClick={() => setSelectedRecipeId(recipes[0].id)}
          className="group relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-borderWarm shadow-card mb-8 sm:mb-10 cursor-pointer transition-all hover:shadow-float"
        >
          <img
            src={recipes[0].image_url}
            alt={recipes[0].title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/35 to-transparent" />

          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white">
            <span className="text-[11px] sm:text-xs uppercase tracking-widest font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-terracotta-500 text-white inline-block mb-1.5 sm:mb-2">
              Featured Kitchen Recipe
            </span>
            <h2 className="font-serif text-2xl sm:text-4xl font-medium tracking-tight drop-shadow-md">
              {recipes[0].title}
            </h2>
            <p className="text-xs sm:text-sm text-cream-200 mt-1 max-w-xl sm:line-clamp-2 leading-relaxed">
              {recipes[0].description}
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2.5 sm:mt-3 text-xs text-cream-300">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-terracotta-300 shrink-0" /> {recipes[0].prep_time}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-botanical-300 shrink-0" /> {recipes[0].serves}
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" /> {recipes[0].difficulty}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Grid */}
      <div className="recipe-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {filtered.map((recipe) => (
          <div
            key={recipe.id}
            onClick={() => setSelectedRecipeId(recipe.id)}
            className="group bg-white rounded-xl border border-borderWarm overflow-hidden shadow-card hover:shadow-subtle hover:border-terracotta-300 transition-all cursor-pointer flex flex-col"
          >
            <div className="h-48 overflow-hidden relative">
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[11px] font-medium bg-white/90 backdrop-blur-sm text-ink-800">
                {recipe.category}
              </span>
            </div>

            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-serif text-xl font-medium text-ink-900 group-hover:text-terracotta-600 transition-colors break-normal">
                  {recipe.title}
                </h3>
                <p className="text-xs text-ink-600 mt-1.5 sm:line-clamp-2 leading-relaxed">
                  {recipe.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-borderWarm-subtle text-xs text-ink-500 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-terracotta-500 shrink-0" />
                  <span>{recipe.prep_time}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Users className="w-3.5 h-3.5 text-botanical-600 shrink-0" />
                  <span>{recipe.serves}</span>
                </div>
                <span className="font-medium text-ink-700 shrink-0">
                  {recipe.difficulty}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
