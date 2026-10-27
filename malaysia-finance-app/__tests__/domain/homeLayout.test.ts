import {
  DEFAULT_HOME_LAYOUT, HOME_WIDGETS, isDefaultLayout, moveItem, parseHomeLayout, resolveCategories, resolveWidgets,
  weekTrend, withCategories, withWidgets,
} from '@/domain/homeLayout';
import type { Category } from '@/domain/types';

const cats: Category[] = [1, 2, 3].map((id) => ({ id, name: `C${id}`, icon: 'cart', sortOrder: id }));

describe('home layout', () => {
  test('by default only today, balance, get started and categories show, in that order', () => {
    const shown = resolveWidgets(DEFAULT_HOME_LAYOUT).filter((w) => w.visible).map((w) => w.id);
    expect(shown).toEqual(['today', 'balance', 'getStarted', 'categories']);
    expect(resolveWidgets(DEFAULT_HOME_LAYOUT)).toHaveLength(HOME_WIDGETS.length);
  });

  test('a chosen order and visibility win, and cards left out follow in default order', () => {
    const prefs = parseHomeLayout(JSON.stringify({ order: ['categories', 'today'], visible: { savings: true, balance: false } }));
    const list = resolveWidgets(prefs);
    expect(list.slice(0, 3).map((w) => w.id)).toEqual(['categories', 'today', 'balance']);
    expect(list.find((w) => w.id === 'savings')!.visible).toBe(true);
    expect(list.find((w) => w.id === 'balance')!.visible).toBe(false);
    expect(list.find((w) => w.id === 'epf')!.visible).toBe(false);
  });

  test('unknown or malformed saved data is ignored', () => {
    expect(parseHomeLayout('not json')).toEqual(DEFAULT_HOME_LAYOUT);
    expect(parseHomeLayout(null)).toEqual(DEFAULT_HOME_LAYOUT);
    const odd = parseHomeLayout(JSON.stringify({ order: ['ghost', 'today', 'today', 4], visible: { today: 'yes' }, categoryOrder: ['x', 2] }));
    expect(resolveWidgets(odd)[0].id).toBe('today');
    expect(resolveWidgets(odd).map((w) => w.id)).toEqual(HOME_WIDGETS.map((w) => w.id));
    expect(odd.categoryOrder).toEqual([2]);
  });

  test('categories follow the chosen order, hide on request and pick up new ones', () => {
    const prefs = parseHomeLayout(JSON.stringify({ categoryOrder: [3, 1, 99], categoryHidden: [1] }));
    expect(resolveCategories(prefs, cats).map((e) => [e.category.id, e.visible])).toEqual([[3, true], [1, false], [2, true]]);
  });

  test('moveItem moves one item and leaves the rest', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(moveItem([1, 2], 5, 0)).toEqual([1, 2]);
  });

  test('saving a resolved list round-trips', () => {
    const widgets = moveItem(resolveWidgets(DEFAULT_HOME_LAYOUT), 3, 0);
    const prefs = withWidgets(DEFAULT_HOME_LAYOUT, widgets);
    expect(resolveWidgets(prefs)).toEqual(widgets);
    expect(isDefaultLayout(prefs)).toBe(false);
    const withCats = withCategories(prefs, resolveCategories(prefs, cats).map((e) => (e.category.id === 2 ? { ...e, visible: false } : e)));
    expect(withCats.categoryHidden).toEqual([2]);
  });

  test('weekTrend sums each of the last 7 days and the 7 before', () => {
    const e = (date: string, amount: number) => ({ date, amount });
    const trend = weekTrend([e('2026-10-27', 500), e('2026-10-27', 100), e('2026-10-21', 300), e('2026-10-20', 900), e('2026-10-14', 200), e('2026-10-13', 50)], '2026-10-27');
    expect(trend.days).toHaveLength(7);
    expect(trend.days[6]).toEqual({ date: '2026-10-27', total: 600 });
    expect(trend.days[0].date).toBe('2026-10-21');
    expect(trend.total).toBe(900);
    expect(trend.previous).toBe(1100);
  });
});
