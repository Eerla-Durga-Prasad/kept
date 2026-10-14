import { describe, it, expect } from 'vitest';
import { searchRecipes, normalizeSearchQuery, getRecipeSuggestions } from '../lib/recipeSearch';
import { COMPREHENSIVE_RECIPES } from '../data/recipeCatalog';

describe('Recipe Discovery & Smart Typo-Tolerant Search', () => {
  it('1. Searches "masala dosa" and returns Crispy Masala Dosa as top match', async () => {
    const res = await searchRecipes('masala dosa');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toBe('Crispy Masala Dosa');
    expect(res.results[0].image_url).toContain('dosa');
  });

  it('2. Tolerates typo "masla dosa" and corrects to Masala Dosa', async () => {
    const res = await searchRecipes('masla dosa');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toBe('Crispy Masala Dosa');
    expect(res.correctedTerm).toBe('masala dosa');
  });

  it('3. Tolerates typo "biriyani" and returns Hyderabadi Dum Biryani', async () => {
    const res = await searchRecipes('biriyani');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toContain('Biryani');
    expect(res.correctedTerm).toBe('biryani');
  });

  it('4. Tolerates typo "paneer butter masla" and returns Paneer Butter Masala', async () => {
    const res = await searchRecipes('paneer butter masla');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toBe('Paneer Butter Masala');
    expect(res.correctedTerm).toBe('paneer butter masala');
  });

  it('5. Searches "mysore bonda" and returns Crispy Mysore Bonda', async () => {
    const res = await searchRecipes('mysore bonda');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toContain('Mysore Bonda');
  });

  it('6. Tolerates typo "idly" and returns Steamed Idli with Sambar & Chutney', async () => {
    const res = await searchRecipes('idly');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toContain('Idli');
    expect(res.correctedTerm).toBe('idli');
  });

  it('7. Searches "chicken curry" and returns Andhra Chicken Curry', async () => {
    const res = await searchRecipes('chicken curry');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toContain('Chicken Curry');
    expect(res.results[0].diet).toBe('Non-Vegetarian');
  });

  it('8. Searches "pulihora" and returns Traditional Andhra Pulihora', async () => {
    const res = await searchRecipes('pulihora');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toContain('Pulihora');
  });

  it('9. Searches "gulab jamun" and returns Gulab Jamun dessert', async () => {
    const res = await searchRecipes('gulab jamun');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toContain('Gulab Jamun');
    expect(res.results[0].category).toBe('Desserts');
  });

  it('10. Searches "pizza" and returns Classic Margherita Pizza', async () => {
    const res = await searchRecipes('pizza');
    expect(res.results.length).toBeGreaterThan(0);
    expect(res.results[0].title).toBe('Classic Margherita Pizza');
    expect(res.results[0].category).toBe('International');
  });

  it('11. Query with no matching result returns empty results array gracefully without error', async () => {
    const res = await searchRecipes('xyz999unmatchedquery');
    expect(res.results).toEqual([]);
    expect(res.totalCount).toBe(0);
  });

  it('12. Autocomplete suggestions provide instant dish names while typing', () => {
    const suggestions = getRecipeSuggestions('masla');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.toLowerCase().includes('dosa'))).toBe(true);
  });

  it('13. Comprehensive recipe catalog contains rich valid ingredients and instructions', () => {
    expect(COMPREHENSIVE_RECIPES.length).toBeGreaterThanOrEqual(15);
    for (const r of COMPREHENSIVE_RECIPES) {
      expect(r.title).toBeTruthy();
      expect(r.image_url).toBeTruthy();
      expect(r.ingredients.length).toBeGreaterThan(0);
      expect(r.instructions.length).toBeGreaterThan(0);
    }
  });

  it('14. Normalizes queries and detects typo corrections accurately', () => {
    const q1 = normalizeSearchQuery('masla dosa');
    expect(q1.hasCorrection).toBe(true);
    expect(q1.corrected).toBe('masala dosa');

    const q2 = normalizeSearchQuery('biriyani');
    expect(q2.hasCorrection).toBe(true);
    expect(q2.corrected).toBe('biryani');
  });
});
