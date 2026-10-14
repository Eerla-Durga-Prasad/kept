import React, { useMemo } from 'react';
import { ShoppingBag, CalendarDays, BookOpen, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { HouseholdMember, Item, Meal, MealType, DayOfWeek } from '../sync/types';
import { NavTab } from '../components/Sidebar';

interface HomeProps {
  currentMember: HouseholdMember;
  items: Item[];
  meals: Meal[];
  onNavigate: (tab: NavTab) => void;
  onOpenSyncModal: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const Home: React.FC<HomeProps> = ({
  currentMember,
  items,
  meals,
  onNavigate,
  onOpenSyncModal,
}) => {
  const activeItems = items.filter((i) => !i.deleted_at);
  const remainingCount = activeItems.filter((i) => !i.checked).length;

  const currentWeekLabel = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const monMonth = monday.toLocaleDateString('en-US', { month: 'short' });
    const sunMonth = sunday.toLocaleDateString('en-US', { month: 'short' });
    if (monMonth === sunMonth) {
      return `This week (${monMonth} ${monday.getDate()} – ${sunday.getDate()})`;
    }
    return `This week (${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()})`;
  }, []);

  // Today's Kitchen Plan: always display in exact order: 1. Breakfast, 2. Lunch, 3. Dinner
  const kitchenPlanMeals = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    const days: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayDayOfWeek = days[today.getDay()];

    const mealOrder: MealType[] = ['Breakfast', 'Lunch', 'Dinner'];
    const result: Meal[] = [];

    for (const type of mealOrder) {
      const found =
        meals.find((meal) => meal.meal_type === type && meal.date === todayStr) ||
        meals.find((meal) => meal.meal_type === type && meal.day_of_week === todayDayOfWeek) ||
        meals.find((meal) => meal.meal_type === type);
      if (found) {
        result.push(found);
      }
    }

    if (result.length === 0) {
      return [...meals]
        .sort((a, b) => {
          const idxA = mealOrder.indexOf(a.meal_type);
          const idxB = mealOrder.indexOf(b.meal_type);
          return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
        })
        .slice(0, 3);
    }

    return result;
  }, [meals]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8 animate-fadeIn">
      {/* Mobile & Desktop Brand & Profile Header */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-borderWarm">
        <div className="flex items-center gap-2">
          <span className="font-serif text-3xl font-semibold tracking-tight text-ink-900">
            Kept
          </span>
          <svg
            className="w-4 h-4 text-terracotta-500 transform -rotate-12 translate-y-[-3px]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
          </svg>
        </div>

        {/* Small user avatar */}
        <button
          type="button"
          onClick={() => onNavigate('household')}
          className="relative group cursor-pointer"
          title="Household Profile"
        >
          {currentMember.avatar_url ? (
            <img
              src={currentMember.avatar_url}
              alt={currentMember.name}
              className="w-9 h-9 rounded-full object-cover border-2 border-borderWarm group-hover:border-terracotta-400 transition-colors"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-cream-200 border border-borderWarm flex items-center justify-center text-xs font-serif font-medium text-ink-800">
              {currentMember.initials}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-botanical-500 border-2 border-white" />
        </button>
      </div>

      {/* Greeting section */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-ink-900">
          {getGreeting()}, {currentMember.name}
        </h1>
        <p className="font-serif italic text-base sm:text-lg text-ink-600 mt-2 font-normal">
          Good food brings people closer.
        </p>
      </div>

      {/* Three large navigation cards matching mobile specification */}
      <div className="home-feature-cards flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 md:grid md:grid-cols-3 md:gap-5 mb-10 scrollbar-none snap-x snap-mandatory">
        {/* Groceries Card */}
        <button
          type="button"
          onClick={() => onNavigate('groceries')}
          className="group relative bg-white rounded-2xl border border-borderWarm p-5 sm:p-6 shadow-card hover:shadow-subtle hover:border-terracotta-300 transition-all text-left flex flex-col justify-between h-44 cursor-pointer min-w-[250px] sm:min-w-[260px] md:min-w-0 flex-1 shrink-0 snap-start"
        >
          <div className="w-10 h-10 rounded-xl bg-terracotta-50 border border-terracotta-100 flex items-center justify-center text-terracotta-600 group-hover:bg-terracotta-500 group-hover:text-white transition-colors">
            <ShoppingBag className="w-5 h-5 stroke-[1.7]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-ink-900 group-hover:text-terracotta-600 transition-colors whitespace-nowrap">
              Groceries
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              {remainingCount} items remaining
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-terracotta-600 group-hover:translate-x-1 transition-all absolute bottom-5 sm:bottom-6 right-5 sm:right-6" />
        </button>

        {/* Meal Planner Card */}
        <button
          type="button"
          onClick={() => onNavigate('meals')}
          className="group relative bg-white rounded-2xl border border-borderWarm p-5 sm:p-6 shadow-card hover:shadow-subtle hover:border-botanical-300 transition-all text-left flex flex-col justify-between h-44 cursor-pointer min-w-[250px] sm:min-w-[260px] md:min-w-0 flex-1 shrink-0 snap-start"
        >
          <div className="w-10 h-10 rounded-xl bg-botanical-50 border border-botanical-100 flex items-center justify-center text-botanical-600 group-hover:bg-botanical-600 group-hover:text-white transition-colors">
            <CalendarDays className="w-5 h-5 stroke-[1.7]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-ink-900 group-hover:text-botanical-700 transition-colors whitespace-nowrap">
              Meal Planner
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              {currentWeekLabel}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-botanical-700 group-hover:translate-x-1 transition-all absolute bottom-5 sm:bottom-6 right-5 sm:right-6" />
        </button>

        {/* Recipes Card */}
        <button
          type="button"
          onClick={() => onNavigate('recipes')}
          className="group relative bg-white rounded-2xl border border-borderWarm p-5 sm:p-6 shadow-card hover:shadow-subtle hover:border-amber-300 transition-all text-left flex flex-col justify-between h-44 cursor-pointer min-w-[250px] sm:min-w-[260px] md:min-w-0 flex-1 shrink-0 snap-start"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <BookOpen className="w-5 h-5 stroke-[1.7]" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-medium text-ink-900 group-hover:text-amber-800 transition-colors whitespace-nowrap">
              Recipes
            </h2>
            <p className="text-xs text-ink-500 mt-1">
              Save and cook
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-ink-400 group-hover:text-amber-700 group-hover:translate-x-1 transition-all absolute bottom-5 sm:bottom-6 right-5 sm:right-6" />
        </button>
      </div>

      {/* Household kitchen spotlight */}
      <div className="bg-cream-card rounded-2xl border border-borderWarm p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-borderWarm-subtle gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-terracotta-500" />
            <h3 className="font-serif text-xl font-medium text-ink-900">
              Today's Kitchen Plan
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenSyncModal}
            className="text-xs text-botanical-700 font-medium flex items-center gap-1.5 hover:underline cursor-pointer shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Synced with household</span>
          </button>
        </div>

        <div className="kitchen-plan-grid grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {kitchenPlanMeals.map((m) => (
            <div
              key={m.id}
              onClick={() => onNavigate('meals')}
              className="group p-3 rounded-xl bg-cream-50 hover:bg-cream-100 border border-borderWarm transition-all cursor-pointer flex items-center gap-3"
            >
              <img
                src={m.image_url}
                alt={m.title}
                className="w-12 h-12 rounded-lg object-cover border border-borderWarm shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[11px] uppercase tracking-wider text-ink-500 block">
                  {m.meal_type}
                </span>
                <span className="text-sm font-medium text-ink-900 line-clamp-1 group-hover:text-terracotta-600 transition-colors">
                  {m.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
