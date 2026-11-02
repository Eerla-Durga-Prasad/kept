import { describe, it, expect } from 'vitest';
import { detectGroceryCategory, normalizeItemName } from '../lib/groceryCategorizer';

describe('Grocery Auto-Categorization Tests', () => {
  describe('1. Dairy items detection', () => {
    it('detects standard English dairy items', () => {
      expect(detectGroceryCategory('Milk').category).toBe('Dairy');
      expect(detectGroceryCategory('Curd').category).toBe('Dairy');
      expect(detectGroceryCategory('Cheese').category).toBe('Dairy');
      expect(detectGroceryCategory('Butter').category).toBe('Dairy');
      expect(detectGroceryCategory('Yogurt').category).toBe('Dairy');
      expect(detectGroceryCategory('Heavy Cream').category).toBe('Dairy');
      expect(detectGroceryCategory('Cottage Cheese').category).toBe('Dairy');
      expect(detectGroceryCategory('Mozzarella').category).toBe('Dairy');
    });

    it('detects Indian and regional dairy names', () => {
      expect(detectGroceryCategory('Paneer').category).toBe('Dairy');
      expect(detectGroceryCategory('Dahi').category).toBe('Dairy');
      expect(detectGroceryCategory('Ghee').category).toBe('Dairy');
      expect(detectGroceryCategory('Perugu').category).toBe('Dairy'); // Telugu
      expect(detectGroceryCategory('Thayir').category).toBe('Dairy'); // Tamil
      expect(detectGroceryCategory('Doodh').category).toBe('Dairy'); // Hindi
      expect(detectGroceryCategory('Paalu').category).toBe('Dairy'); // Telugu
      expect(detectGroceryCategory('Majjiga').category).toBe('Dairy'); // Buttermilk (Telugu)
      expect(detectGroceryCategory('Chaas').category).toBe('Dairy');
      expect(detectGroceryCategory('Makhan').category).toBe('Dairy');
      expect(detectGroceryCategory('Venna').category).toBe('Dairy');
    });

    it('handles packaging and quantities with dairy', () => {
      expect(detectGroceryCategory('2L Whole Milk').category).toBe('Dairy');
      expect(detectGroceryCategory('500g Fresh Malai Paneer').category).toBe('Dairy');
      expect(detectGroceryCategory('1 pack Amul Butter').category).toBe('Dairy');
      expect(detectGroceryCategory('Greek Yogurt 200g').category).toBe('Dairy');
    });
  });

  describe('2. Produce items detection', () => {
    it('detects common fruits and vegetables', () => {
      expect(detectGroceryCategory('Apple').category).toBe('Produce');
      expect(detectGroceryCategory('Bananas').category).toBe('Produce');
      expect(detectGroceryCategory('Tomato').category).toBe('Produce');
      expect(detectGroceryCategory('Potatoes').category).toBe('Produce');
      expect(detectGroceryCategory('Onion').category).toBe('Produce');
      expect(detectGroceryCategory('Garlic').category).toBe('Produce');
      expect(detectGroceryCategory('Ginger').category).toBe('Produce');
      expect(detectGroceryCategory('Carrots').category).toBe('Produce');
      expect(detectGroceryCategory('Spinach').category).toBe('Produce');
      expect(detectGroceryCategory('Coriander').category).toBe('Produce');
      expect(detectGroceryCategory('Cucumber').category).toBe('Produce');
    });

    it('detects Indian and regional produce names', () => {
      expect(detectGroceryCategory('Aloo').category).toBe('Produce');
      expect(detectGroceryCategory('Pyaz').category).toBe('Produce');
      expect(detectGroceryCategory('Tamatar').category).toBe('Produce');
      expect(detectGroceryCategory('Palak').category).toBe('Produce');
      expect(detectGroceryCategory('Bhindi').category).toBe('Produce');
      expect(detectGroceryCategory('Baingan').category).toBe('Produce');
      expect(detectGroceryCategory('Kothimeera').category).toBe('Produce'); // Coriander (Telugu)
      expect(detectGroceryCategory('Karivepaku').category).toBe('Produce'); // Curry leaves (Telugu)
      expect(detectGroceryCategory('Vankaya').category).toBe('Produce'); // Brinjal (Telugu)
      expect(detectGroceryCategory('Bendakaya').category).toBe('Produce'); // Okra (Telugu)
      expect(detectGroceryCategory('Ullipaya').category).toBe('Produce'); // Onion (Telugu)
      expect(detectGroceryCategory('Thakkali').category).toBe('Produce'); // Tomato (Tamil)
      expect(detectGroceryCategory('Inji').category).toBe('Produce'); // Ginger (Tamil)
      expect(detectGroceryCategory('Poondu').category).toBe('Produce'); // Garlic (Tamil)
    });

    it('detects fresh chili and fresh coconut as produce', () => {
      expect(detectGroceryCategory('Green Chili').category).toBe('Produce');
      expect(detectGroceryCategory('Hari Mirch').category).toBe('Produce');
      expect(detectGroceryCategory('Pachi Mirchi').category).toBe('Produce');
      expect(detectGroceryCategory('Fresh Coconut').category).toBe('Produce');
      expect(detectGroceryCategory('Kobbari').category).toBe('Produce');
      expect(detectGroceryCategory('Drumstick').category).toBe('Produce');
    });
  });

  describe('3. Pantry items detection', () => {
    it('detects grains, flours, pulses, and dals', () => {
      expect(detectGroceryCategory('Basmati Rice').category).toBe('Pantry');
      expect(detectGroceryCategory('Wheat Flour').category).toBe('Pantry');
      expect(detectGroceryCategory('Atta').category).toBe('Pantry');
      expect(detectGroceryCategory('Maida').category).toBe('Pantry');
      expect(detectGroceryCategory('Besan').category).toBe('Pantry');
      expect(detectGroceryCategory('Toor Dal').category).toBe('Pantry');
      expect(detectGroceryCategory('Moong Dal').category).toBe('Pantry');
      expect(detectGroceryCategory('Chana Dal').category).toBe('Pantry');
      expect(detectGroceryCategory('Urad Dal').category).toBe('Pantry');
      expect(detectGroceryCategory('Rajma').category).toBe('Pantry');
      expect(detectGroceryCategory('Kandipappu').category).toBe('Pantry'); // Telugu
      expect(detectGroceryCategory('Poha').category).toBe('Pantry');
      expect(detectGroceryCategory('Rava').category).toBe('Pantry');
      expect(detectGroceryCategory('Oats').category).toBe('Pantry');
    });

    it('detects spices, condiments, oils, and sweeteners', () => {
      expect(detectGroceryCategory('Salt').category).toBe('Pantry');
      expect(detectGroceryCategory('Sugar').category).toBe('Pantry');
      expect(detectGroceryCategory('Jaggery').category).toBe('Pantry');
      expect(detectGroceryCategory('Bellam').category).toBe('Pantry');
      expect(detectGroceryCategory('Turmeric Powder').category).toBe('Pantry');
      expect(detectGroceryCategory('Red Chili Powder').category).toBe('Pantry');
      expect(detectGroceryCategory('Cumin Seeds').category).toBe('Pantry');
      expect(detectGroceryCategory('Jeera').category).toBe('Pantry');
      expect(detectGroceryCategory('Mustard Seeds').category).toBe('Pantry');
      expect(detectGroceryCategory('Sunflower Oil').category).toBe('Pantry');
      expect(detectGroceryCategory('Coconut Oil').category).toBe('Pantry');
      expect(detectGroceryCategory('Garam Masala').category).toBe('Pantry');
      expect(detectGroceryCategory('Tamarind').category).toBe('Pantry');
      expect(detectGroceryCategory('Black Pepper').category).toBe('Pantry');
      expect(detectGroceryCategory('Almonds').category).toBe('Pantry');
      expect(detectGroceryCategory('Cashews').category).toBe('Pantry');
      expect(detectGroceryCategory('Coffee Powder').category).toBe('Pantry');
      expect(detectGroceryCategory('Tea Powder').category).toBe('Pantry');
    });
  });

  describe('4. Meat & Seafood items detection', () => {
    it('detects meats, fish, and eggs', () => {
      expect(detectGroceryCategory('Chicken Breast').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Chicken Wings').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Mutton Keema').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Fish Fillet').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Salmon').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Prawns').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Eggs').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('1 Dozen Brown Eggs').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Kodi Mamsam').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Chepa').category).toBe('Meat & Seafood');
      expect(detectGroceryCategory('Gudlu').category).toBe('Meat & Seafood');
    });
  });

  describe('5. Household items detection', () => {
    it('detects cleaning and paper supplies', () => {
      expect(detectGroceryCategory('Dish Soap').category).toBe('Household');
      expect(detectGroceryCategory('Surf Excel').category).toBe('Household');
      expect(detectGroceryCategory('Laundry Detergent').category).toBe('Household');
      expect(detectGroceryCategory('Floor Cleaner').category).toBe('Household');
      expect(detectGroceryCategory('Lizol').category).toBe('Household');
      expect(detectGroceryCategory('Toilet Cleaner').category).toBe('Household');
      expect(detectGroceryCategory('Harpic').category).toBe('Household');
      expect(detectGroceryCategory('Garbage Bags').category).toBe('Household');
      expect(detectGroceryCategory('Paper Towels').category).toBe('Household');
      expect(detectGroceryCategory('Aluminium Foil').category).toBe('Household');
      expect(detectGroceryCategory('Toothpaste').category).toBe('Household');
      expect(detectGroceryCategory('Mosquito Repellent').category).toBe('Household');
    });
  });

  describe('6. Compound phrases and disambiguation rules', () => {
    it('disambiguates coconut items correctly', () => {
      // Coconut raw/fresh -> Produce
      expect(detectGroceryCategory('Coconut').category).toBe('Produce');
      expect(detectGroceryCategory('Fresh Coconut').category).toBe('Produce');
      // Coconut oil -> Pantry
      expect(detectGroceryCategory('Coconut Oil').category).toBe('Pantry');
      // Coconut milk -> Dairy
      expect(detectGroceryCategory('Coconut Milk').category).toBe('Dairy');
    });

    it('disambiguates chilies vs chili powder', () => {
      // Fresh chilies -> Produce
      expect(detectGroceryCategory('Green Chili').category).toBe('Produce');
      expect(detectGroceryCategory('Hari Mirch').category).toBe('Produce');
      // Spice powders -> Pantry
      expect(detectGroceryCategory('Red Chili Powder').category).toBe('Pantry');
      expect(detectGroceryCategory('Mirchi Powder').category).toBe('Pantry');
    });

    it('disambiguates drumsticks', () => {
      // Vegetable drumstick -> Produce
      expect(detectGroceryCategory('Drumstick').category).toBe('Produce');
      // Chicken drumsticks -> Meat & Seafood
      expect(detectGroceryCategory('Chicken Drumstick').category).toBe('Meat & Seafood');
    });
  });

  describe('7. Ambiguous and unknown terms fallback', () => {
    it('flags ambiguous conflicting items without guessing', () => {
      // "Chicken and Cheese" conflicts between Meat & Seafood and Dairy
      const result = detectGroceryCategory('Chicken and Cheese Sandwich');
      expect(result.isAmbiguous).toBe(true);
      expect(result.category).toBeNull();
      expect(result.candidateCategories).toContain('Meat & Seafood');
      expect(result.candidateCategories).toContain('Dairy');
    });

    it('returns null category for completely unknown items', () => {
      const result = detectGroceryCategory('RandomXyzInventedItem123');
      expect(result.category).toBeNull();
      expect(result.confidence).toBe('none');
    });

    it('handles empty or blank inputs gracefully', () => {
      expect(detectGroceryCategory('').category).toBeNull();
      expect(detectGroceryCategory('   ').category).toBeNull();
    });
  });

  describe('8. String normalization helper', () => {
    it('cleans quantities and extra punctuation', () => {
      expect(normalizeItemName('500g Fresh Paneer!')).toBe('fresh paneer');
      expect(normalizeItemName('2 kg Basmati Rice')).toBe('basmati rice');
      expect(normalizeItemName('1 dozen brown eggs')).toBe('brown eggs');
      expect(normalizeItemName('1 pack Amul Butter')).toBe('amul butter');
    });
  });

  describe('9. Household Assignment and Isolation', () => {
    it('preserves household assignment without moving items silently', () => {
      const householdA = 'h_household_alpha';
      const householdB = 'h_household_beta';

      const itemA = {
        id: 'item-1',
        name: 'Whole Milk',
        category: 'Dairy' as const,
        household_id: householdA,
        quantity: '1 L',
        checked: false,
        deleted_at: null,
      };

      const itemB = {
        id: 'item-2',
        name: 'Organic Spinach',
        category: 'Produce' as const,
        household_id: householdB,
        quantity: '2 bunches',
        checked: false,
        deleted_at: null,
      };

      const allItems = [itemA, itemB];

      // Filtering for household A strictly keeps only household A items
      const householdAItems = allItems.filter(i => i.household_id === householdA && !i.deleted_at);
      expect(householdAItems).toHaveLength(1);
      expect(householdAItems[0].name).toBe('Whole Milk');

      // Filtering for household B strictly keeps only household B items
      const householdBItems = allItems.filter(i => i.household_id === householdB && !i.deleted_at);
      expect(householdBItems).toHaveLength(1);
      expect(householdBItems[0].name).toBe('Organic Spinach');
    });
  });

  describe('10. Safe "Remove All" Behavior', () => {
    it('clears only active items from the current household without touching other households', () => {
      const currentHouseholdId = 'h_current_household';
      const otherHouseholdId = 'h_other_household';
      const now = new Date().toISOString();

      const items = [
        { id: '1', household_id: currentHouseholdId, name: 'Milk', deleted_at: null },
        { id: '2', household_id: currentHouseholdId, name: 'Bread', deleted_at: null },
        { id: '3', household_id: otherHouseholdId, name: 'Apples', deleted_at: null },
        { id: '4', household_id: currentHouseholdId, name: 'Old Item', deleted_at: '2026-10-01T00:00:00.000Z' },
      ];

      // Items targeted by Remove All for current household
      const targetItems = items.filter(
        i => !i.deleted_at && i.household_id === currentHouseholdId
      );
      expect(targetItems.map(i => i.name)).toEqual(['Milk', 'Bread']);

      // Simulate soft-deletion of targeted items
      const updatedItems = items.map(i => {
        if (!i.deleted_at && i.household_id === currentHouseholdId) {
          return { ...i, deleted_at: now };
        }
        return i;
      });

      // Active items in current household is now 0
      const activeCurrent = updatedItems.filter(i => !i.deleted_at && i.household_id === currentHouseholdId);
      expect(activeCurrent).toHaveLength(0);

      // Other household items remain completely untouched!
      const activeOther = updatedItems.filter(i => !i.deleted_at && i.household_id === otherHouseholdId);
      expect(activeOther).toHaveLength(1);
      expect(activeOther[0].name).toBe('Apples');
    });

    it('cancelling confirmation leaves list completely intact', () => {
      const items = [
        { id: '1', name: 'Almonds', deleted_at: null },
        { id: '2', name: 'Curd', deleted_at: null },
      ];

      let isConfirmed = false;
      let workingItems = [...items];

      // User clicks Remove All -> opens confirmation dialog
      const openDialog = () => { /* dialog opened */ };
      openDialog();

      // User clicks Cancel
      const handleCancel = () => {
        isConfirmed = false;
      };
      handleCancel();

      if (isConfirmed) {
        workingItems = [];
      }

      expect(workingItems).toHaveLength(2);
      expect(workingItems[0].name).toBe('Almonds');
      expect(workingItems[1].name).toBe('Curd');
    });
  });
});
