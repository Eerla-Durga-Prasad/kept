import { describe, it, expect } from 'vitest';
import { resolveMealImage, getCachedMealImage, SAFE_FALLBACK_FOOD_IMAGE } from '../lib/foodImageResolver';
import { getMealDefinition } from '../lib/mealCatalog';

describe('Custom Meal Image Matching & Normalization Tests', () => {
  it('1. Resolves Mysore Bonda with exact and case-insensitive matching', async () => {
    const img1 = await resolveMealImage('Mysore Bonda');
    const img2 = await resolveMealImage('mysore bonda');
    expect(img1).toBeDefined();
    expect(img1).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img1.toLowerCase()).toContain('mysore-bonda');
    expect(img2).toBe(img1);
  });

  it('2. Resolves Chicken 65 and handles variations like chicken65 and Chicken-65', async () => {
    const img1 = await resolveMealImage('Chicken 65');
    const img2 = await resolveMealImage('chicken65');
    const img3 = await resolveMealImage('Chicken-65');

    expect(img1).toBeDefined();
    expect(img1).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img1.toLowerCase()).toContain('chicken');
    expect(img2).toBe(img1);
    expect(img3).toBe(img1);
  });

  it('3. Resolves Masala Dosa and tolerates typo "masala dosae"', async () => {
    const img1 = await resolveMealImage('Masala Dosa');
    const img2 = await resolveMealImage('masala dosae');

    expect(img1).toBeDefined();
    expect(img1).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img1.toLowerCase()).toContain('dosa');
    expect(img2).toBe(img1);
  });

  it('4. Resolves Paneer Butter Masala and tolerates typo "panner butter masala"', async () => {
    const img1 = await resolveMealImage('Paneer Butter Masala');
    const img2 = await resolveMealImage('panner butter masala');

    expect(img1).toBeDefined();
    expect(img1).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img1.toLowerCase()).toContain('paneer');
    expect(img2).toBe(img1);
  });

  it('5. Resolves Gobi Manchurian and tolerates typo "gobi manchuriyan"', async () => {
    const img1 = await resolveMealImage('Gobi Manchurian');
    const img2 = await resolveMealImage('gobi manchuriyan');

    expect(img1).toBeDefined();
    expect(img1).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img1.toLowerCase()).toContain('gobi-manchurian');
    expect(img2).toBe(img1);
  });

  it('6. Resolves Fried Rice correctly', async () => {
    const img = await resolveMealImage('Fried Rice');
    expect(img).toBeDefined();
    expect(img).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img.toLowerCase()).toContain('fried-rice');
  });

  it('7. Resolves Wada and Chatni correctly and matches URL expectation', async () => {
    const img = await resolveMealImage('Wada and Chatni');
    expect(img).toBeDefined();
    expect(img).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img.toLowerCase()).toMatch(/wada|vada/);
  });

  it('8. Resolves Pesarattu correctly', async () => {
    const img = await resolveMealImage('Pesarattu');
    expect(img).toBeDefined();
    expect(img).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img.toLowerCase()).toContain('pesarattu');
  });

  it('9. Resolves Poha correctly', async () => {
    const img = await resolveMealImage('Poha');
    expect(img).toBeDefined();
    expect(img).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img.toLowerCase()).toContain('poha');
  });

  it('10. Resolves Lemon Rice correctly', async () => {
    const img = await resolveMealImage('Lemon Rice');
    expect(img).toBeDefined();
    expect(img).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img.toLowerCase()).toContain('lemon-rice');
  });

  it('11. Resolves Veg Biryani and tolerates typo "veg biryanii"', async () => {
    const img1 = await resolveMealImage('Veg Biryani');
    const img2 = await resolveMealImage('veg biryanii');

    expect(img1).toBeDefined();
    expect(img1).not.toBe(SAFE_FALLBACK_FOOD_IMAGE);
    expect(img1.toLowerCase()).toContain('veg-biryani');
    expect(img2).toBe(img1);
  });

  it('12. Arbitrary new meal name resolution does not crash and returns valid image or neutral fallback', async () => {
    const img = await resolveMealImage('Arbitrary Unknown Dish 12345');
    expect(img).toBeDefined();
    expect(typeof img).toBe('string');
    expect(img).toBe(SAFE_FALLBACK_FOOD_IMAGE);
  });

  it('13. Empty meal name returns neutral fallback safely without searching', async () => {
    const img = await resolveMealImage('   ');
    expect(img).toBe(SAFE_FALLBACK_FOOD_IMAGE);
  });

  it('14. Caching: getCachedMealImage retrieves resolved images instantly without network', async () => {
    const cached = getCachedMealImage('Mysore Bonda');
    expect(cached).toBeDefined();
    expect(cached?.toLowerCase()).toContain('mysore-bonda');
  });

  it('15. Single source of truth: getMealDefinition preserves the custom meal image', () => {
    const customSlot = {
      id: 'm_test_999',
      title: 'Mysore Bonda',
      image_url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80&dish=mysore-bonda',
    };
    const def = getMealDefinition(customSlot);
    expect(def?.name).toBe('Mysore Bonda');
    expect(def?.image).toBe(customSlot.image_url);
  });
});
