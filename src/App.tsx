import React, { useState, useEffect, useCallback } from 'react';
import { db } from './db/database';
import {
  Item,
  CategoryType,
  HouseholdMember,
  Recipe,
  Meal,
  RecipeIngredient,
  DayOfWeek,
  MealType,
} from './sync/types';
import { syncEngine, SyncEngineStatus } from './sync/syncEngine';
import { realtimeCoordinator } from './sync/realtime';
import { initializeDatabaseSeed } from './lib/seedData';
import { enqueueOutboxOperation, generateUUID } from './sync/outbox';

// Components
import { Sidebar, NavTab } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { TopBar } from './components/TopBar';
import { AddItemSheet } from './components/AddItemSheet';
import { SyncModal } from './components/SyncModal';
import { HouseholdModal } from './components/HouseholdModal';
import { JoinHouseholdView } from './components/JoinHouseholdView';

// Pages
import { Groceries } from './pages/Groceries';
import { Home } from './pages/Home';
import { Meals } from './pages/Meals';
import { Recipes } from './pages/Recipes';
import { Household } from './pages/Household';
import { Settings } from './pages/Settings';
import { MobileGroceryView } from './pages/MobileGroceryView';

export const App: React.FC = () => {
  // Helpers to resolve tab and invite tokens from current URL location
  const getTabFromLocation = (): NavTab => {
    if (typeof window === 'undefined') return 'groceries';
    const path = window.location.pathname.toLowerCase().replace(/^\/|\/$/g, '');
    if (path === 'household') return 'household';
    if (path === 'home') return 'home';
    if (path === 'meals') return 'meals';
    if (path === 'recipes') return 'recipes';
    if (path === 'settings') return 'settings';
    return 'groceries';
  };

  const getInviteTokenFromLocation = (): string | null => {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get('token') || searchParams.get('invite');
    if (tokenParam !== null) return tokenParam.trim();
    if (window.location.pathname.startsWith('/join')) {
      const match = window.location.pathname.match(/\/join\/([^/?#]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]).trim();
      }
      return ''; // Route /join without specific token
    }
    return null;
  };

  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<NavTab>(getTabFromLocation);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [addItemCategory, setAddItemCategory] = useState<CategoryType>('Produce');
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);

  // Data state
  const [items, setItems] = useState<Item[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [currentMember, setCurrentMember] = useState<HouseholdMember | null>(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>(syncEngine.getStatus());

  // Invitation token detection from URL
  const [inviteToken, setInviteToken] = useState<string | null>(getInviteTokenFromLocation);

  // URL synchronization
  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      const targetPath = tab === 'groceries' ? '/' : `/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const handleUrlChange = () => {
      setInviteToken(getInviteTokenFromLocation());
      setCurrentTab(getTabFromLocation());
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // Load data from Dexie
  const refreshAllData = useCallback(async () => {
    const [loadedItems, loadedMembers, loadedRecipes, loadedMeals] = await Promise.all([
      db.items.toArray(),
      db.household_members.toArray(),
      db.recipes.toArray(),
      db.meals.toArray(),
    ]);

    setItems(loadedItems);
    setMembers(loadedMembers);
    setRecipes(loadedRecipes);
    setMeals(loadedMeals);

    if (loadedMembers.length > 0) {
      const activeUserId = syncEngine.getCurrentUserId();
      const authenticatedMember =
        (currentMember && loadedMembers.some((m) => m.id === currentMember.id && (m.role === 'Owner' || m.user_id === activeUserId))
          ? loadedMembers.find((m) => m.id === currentMember.id)!
          : null) ||
        loadedMembers.find((m) => m.role === 'Owner') ||
        loadedMembers.find((m) => m.user_id === activeUserId) ||
        loadedMembers[0];

      if (!currentMember || currentMember.id !== authenticatedMember.id) {
        setCurrentMember(authenticatedMember);
        syncEngine.setCurrentUserId(authenticatedMember.user_id);
      }
    }
  }, [currentMember]);

  // Initial load & listeners
  useEffect(() => {
    let unsubscribeSync: (() => void) | undefined;

    const setup = async () => {
      await initializeDatabaseSeed();
      await refreshAllData();
      realtimeCoordinator.init();

      unsubscribeSync = syncEngine.subscribe((status) => {
        setSyncStatus(status);
        // Refresh local items state when sync finishes
        db.items.toArray().then(setItems);
      });
    };

    setup();

    return () => {
      if (unsubscribeSync) unsubscribeSync();
    };
  }, [refreshAllData]);

  // Item Mutations (Offline-First via syncEngine)
  const handleToggleCheck = async (itemId: string, currentChecked: boolean) => {
    const updated = await syncEngine.mutateItem(itemId, {
      checked: !currentChecked,
    });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    realtimeCoordinator.broadcastItemUpdate(updated);
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: string) => {
    const updated = await syncEngine.mutateItem(itemId, {
      quantity: newQuantity,
    });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    realtimeCoordinator.broadcastItemUpdate(updated);
  };

  const handleDeleteItem = async (itemId: string) => {
    const now = new Date().toISOString();
    const updated = await syncEngine.mutateItem(itemId, {
      deleted_at: now,
    });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
    realtimeCoordinator.broadcastItemUpdate(updated);
  };

  const handleCreateItem = async (newItem: {
    name: string;
    quantity: string;
    category: CategoryType;
    addToMealPlan: boolean;
  }) => {
    const created = await syncEngine.createItem({
      household_id: 'h_default_household_01',
      list_id: 'l_main_kitchen_list_01',
      name: newItem.name,
      quantity: newItem.quantity,
      category: newItem.category,
      checked: false,
      deleted_at: null,
    });

    setItems((prev) => [...prev, created]);
    realtimeCoordinator.broadcastItemUpdate(created);
  };

  // Recipe actions
  const handleAddIngredientToList = async (name: string, quantity: string) => {
    await handleCreateItem({
      name,
      quantity,
      category: 'Pantry',
      addToMealPlan: false,
    });
  };

  const handleAddAllIngredientsToList = async (ingredients: RecipeIngredient[]) => {
    for (const ing of ingredients) {
      await handleCreateItem({
        name: ing.name,
        quantity: ing.quantity,
        category: 'Produce',
        addToMealPlan: false,
      });
    }
  };

  // Meal Planner actions
  const handleSaveMeal = async (params: {
    existingMealId?: string;
    household_id: string;
    date: string;
    week_start: string;
    day_of_week: DayOfWeek;
    meal_type: MealType;
    title: string;
    image_url: string;
    recipe_id?: string;
  }) => {
    const clientId = syncEngine.getClientId();
    if (params.existingMealId) {
      const existing = await db.meals.get(params.existingMealId);
      const updated: Meal = {
        ...(existing || {}),
        id: params.existingMealId,
        household_id: params.household_id,
        date: params.date,
        week_start: params.week_start,
        day_of_week: params.day_of_week,
        meal_type: params.meal_type,
        title: params.title,
        image_url: params.image_url,
        recipe_id: params.recipe_id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      if (!params.recipe_id) {
        delete updated.recipe_id;
      }

      await db.transaction('rw', db.meals, db.outbox_operations, async () => {
        await db.meals.put(updated);
        await enqueueOutboxOperation(
          'meals',
          updated.id,
          'UPDATE',
          { ...updated },
          clientId
        );
      });

      setMeals((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } else {
      const newMeal: Meal = {
        id: generateUUID(),
        household_id: params.household_id,
        date: params.date,
        week_start: params.week_start,
        day_of_week: params.day_of_week,
        meal_type: params.meal_type,
        title: params.title,
        image_url: params.image_url,
        recipe_id: params.recipe_id,
        created_at: new Date().toISOString(),
      };
      if (!params.recipe_id) {
        delete newMeal.recipe_id;
      }

      await db.transaction('rw', db.meals, db.outbox_operations, async () => {
        await db.meals.put(newMeal);
        await enqueueOutboxOperation(
          'meals',
          newMeal.id,
          'INSERT',
          { ...newMeal },
          clientId
        );
      });

      setMeals((prev) => [...prev, newMeal]);
    }

    if (syncEngine.isEffectivelyOnline()) {
      syncEngine.flushOutbox();
    }
  };

  const handleDeleteMeal = async (mealId: string) => {
    const clientId = syncEngine.getClientId();
    await db.transaction('rw', db.meals, db.outbox_operations, async () => {
      await db.meals.delete(mealId);
      await enqueueOutboxOperation(
        'meals',
        mealId,
        'DELETE',
        { id: mealId },
        clientId
      );
    });

    setMeals((prev) => prev.filter((m) => m.id !== mealId));

    if (syncEngine.isEffectivelyOnline()) {
      syncEngine.flushOutbox();
    }
  };

  const handleAddMeal = async (newMeal: Omit<Meal, 'id' | 'created_at'>) => {
    const mealWithId: Meal = {
      ...newMeal,
      id: `m_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    await db.meals.add(mealWithId);
    setMeals((prev) => [...prev, mealWithId]);
  };

  // Household Member Add
  const handleAddHouseholdMember = async (name: string, role: 'Owner' | 'Member') => {
    const initials = name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);

    const newMem: HouseholdMember = {
      id: `m_${Date.now()}`,
      household_id: 'h_default_household_01',
      user_id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      role,
      initials,
      created_at: new Date().toISOString(),
    };

    await db.household_members.add(newMem);
    setMembers((prev) => [...prev, newMem]);
    setIsHouseholdModalOpen(false);
  };

  // Household Member Update (Offline-First via Dexie + Outbox)
  const handleUpdateHouseholdMember = async (updated: HouseholdMember) => {
    const clientId = syncEngine.getClientId();
    await db.transaction('rw', db.household_members, db.outbox_operations, async () => {
      await db.household_members.put(updated);
      await enqueueOutboxOperation(
        'household_members',
        updated.id,
        'UPDATE',
        { ...updated },
        clientId
      );
    });

    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    if (currentMember?.id === updated.id) {
      setCurrentMember(updated);
    }
  };

  const activeGroceryCount = items.filter((i) => !i.deleted_at && !i.checked).length;

  if (inviteToken !== null) {
    return (
      <JoinHouseholdView
        token={inviteToken}
        onJoinSuccess={async () => {
          await refreshAllData();
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, '', '/household');
          }
          setInviteToken(null);
          setCurrentTab('household');
        }}
        onCancel={() => {
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, '', '/household');
          }
          setInviteToken(null);
          setCurrentTab('household');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cream-100 flex flex-col font-sans text-ink-900">
      {/* Top Application Bar (Viewport mode switcher, offline simulation, sync pill) */}
      <TopBar
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        syncStatus={syncStatus}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        onToggleOffline={() => syncEngine.setSimulatedOffline(!syncStatus.isSimulatedOffline)}
      />

      {/* Main Content Layout */}
      {viewMode === 'mobile' ? (
        /* Dedicated Mobile 390px Viewport Frame */
        <div className="flex-1 flex items-center justify-center p-0 sm:p-6 bg-cream-200/50">
          <div className="mobile-view w-full sm:max-w-[390px] h-[100dvh] sm:h-[844px] bg-cream-50 sm:rounded-[36px] sm:border-[8px] sm:border-ink-900 sm:shadow-float overflow-hidden flex flex-col relative">
            {/* Mobile Top Notch bar on simulated device */}
            <div className="hidden sm:flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-medium text-ink-900 select-none shrink-0">
              <span>9:41</span>
              <div className="w-24 h-4 bg-ink-900 rounded-full" />
              <span>5G</span>
            </div>

            {/* Mobile Screen Router */}
            <div className="flex-1 overflow-y-auto relative">
              {currentTab === 'groceries' ? (
                <MobileGroceryView
                  items={items}
                  onBack={() => handleSelectTab('home')}
                  onToggleCheck={handleToggleCheck}
                  onUpdateQuantity={handleUpdateQuantity}
                  onDeleteItem={handleDeleteItem}
                  onOpenAddItem={(cat) => {
                    if (cat) setAddItemCategory(cat);
                    setIsAddItemOpen(true);
                  }}
                  onOpenSyncModal={() => setIsSyncModalOpen(true)}
                  syncStatus={syncStatus}
                />
              ) : currentTab === 'home' ? (
                <Home
                  currentMember={currentMember || members[0] || { id: 'm_dp', name: 'Durga Prasad', initials: 'DP', role: 'Owner', user_id: 'durga_prasad', household_id: 'h1', created_at: '' }}
                  items={items}
                  meals={meals}
                  onNavigate={handleSelectTab}
                  onOpenSyncModal={() => setIsSyncModalOpen(true)}
                />
              ) : currentTab === 'meals' ? (
                <div className="pb-24">
                  <Meals
                    meals={meals}
                    recipes={recipes}
                    onSaveMeal={handleSaveMeal}
                    onDeleteMeal={handleDeleteMeal}
                    onAddMeal={handleAddMeal}
                    isMobile={true}
                  />
                </div>
              ) : currentTab === 'recipes' ? (
                <div className="pb-24">
                  <Recipes
                    recipes={recipes}
                    onAddIngredientToList={handleAddIngredientToList}
                    onAddAllIngredientsToList={handleAddAllIngredientsToList}
                  />
                </div>
              ) : currentTab === 'household' ? (
                <div className="pb-24">
                  <Household
                    members={members}
                    currentMember={currentMember || members[0]}
                    onOpenInviteModal={() => setIsHouseholdModalOpen(true)}
                    onUpdateMember={handleUpdateHouseholdMember}
                  />
                </div>
              ) : (
                <div className="pb-24">
                  <Settings
                    currentMember={currentMember || members[0]}
                    members={members}
                    onSelectMember={setCurrentMember}
                    onRefreshAllData={refreshAllData}
                  />
                </div>
              )}
            </div>

            {/* Mobile bottom navigation (No desktop sidebar on mobile) */}
            <MobileNav
              currentTab={currentTab}
              onSelectTab={handleSelectTab}
              groceryBadgeCount={activeGroceryCount}
            />
          </div>
        </div>
      ) : (
        /* Desktop Application Structure (Left Sidebar + Main Screen) */
        <div className="flex-1 flex max-w-[1700px] w-full mx-auto">
          {/* Left Desktop Sidebar */}
          <Sidebar
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            members={members}
            onInviteMember={() => setIsHouseholdModalOpen(true)}
            onOpenSyncModal={() => setIsSyncModalOpen(true)}
            isOnline={syncStatus.isOnline}
            pendingCount={syncStatus.pendingCount}
          />

          {/* Desktop Main Content Area */}
          <main className="flex-1 min-w-0 bg-cream-100 overflow-y-auto pb-20 md:pb-0">
            {currentTab === 'groceries' && (
              <Groceries
                items={items}
                onToggleCheck={handleToggleCheck}
                onUpdateQuantity={handleUpdateQuantity}
                onDeleteItem={handleDeleteItem}
                onOpenAddItem={(cat) => {
                  if (cat) setAddItemCategory(cat);
                  setIsAddItemOpen(true);
                }}
                onOpenSyncModal={() => setIsSyncModalOpen(true)}
              />
            )}

            {currentTab === 'home' && (
              <Home
                currentMember={currentMember || members[0] || { id: 'm_dp', name: 'Durga Prasad', initials: 'DP', role: 'Owner', user_id: 'durga_prasad', household_id: 'h1', created_at: '' }}
                items={items}
                meals={meals}
                onNavigate={handleSelectTab}
                onOpenSyncModal={() => setIsSyncModalOpen(true)}
              />
            )}

            {currentTab === 'meals' && (
              <Meals
                meals={meals}
                recipes={recipes}
                onSaveMeal={handleSaveMeal}
                onDeleteMeal={handleDeleteMeal}
                onAddMeal={handleAddMeal}
              />
            )}

            {currentTab === 'recipes' && (
              <Recipes
                recipes={recipes}
                items={items}
                onAddIngredientToList={handleAddIngredientToList}
                onAddAllIngredientsToList={handleAddAllIngredientsToList}
              />
            )}

            {currentTab === 'household' && (
              <Household
                members={members}
                currentMember={currentMember || members[0]}
                onOpenInviteModal={() => setIsHouseholdModalOpen(true)}
                onUpdateMember={handleUpdateHouseholdMember}
              />
            )}

            {currentTab === 'settings' && (
              <Settings
                currentMember={currentMember || members[0]}
                members={members}
                onSelectMember={setCurrentMember}
                onRefreshAllData={refreshAllData}
              />
            )}
          </main>

          {/* Mobile bottom nav on small viewports when in desktop layout mode */}
          <MobileNav
            currentTab={currentTab}
            onSelectTab={handleSelectTab}
            groceryBadgeCount={activeGroceryCount}
          />
        </div>
      )}

      {/* Add Item Bottom-Sheet / Modal */}
      <AddItemSheet
        isOpen={isAddItemOpen}
        onClose={() => setIsAddItemOpen(false)}
        onAddItem={handleCreateItem}
        defaultCategory={addItemCategory}
      />

      {/* Sync Status Screen / Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        syncStatus={syncStatus}
        items={items}
      />

      {/* Household Invite Member Modal */}
      <HouseholdModal
        isOpen={isHouseholdModalOpen}
        onClose={() => setIsHouseholdModalOpen(false)}
        members={members}
        onAddMember={handleAddHouseholdMember}
      />
    </div>
  );
};
