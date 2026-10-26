import { BILLERS, BILLER_GROUPS, billerFor, billersIn } from '@/domain/billers';

describe('billers', () => {
  test('ids are unique and every group has billers', () => {
    expect(new Set(BILLERS.map((b) => b.id)).size).toBe(BILLERS.length);
    for (const g of BILLER_GROUPS) expect(billersIn(g).length).toBeGreaterThan(0);
  });

  test('the common Malaysian billers are there', () => {
    const names = BILLERS.map((b) => b.name);
    for (const n of ['TNB electricity', 'Air Selangor', 'Unifi', 'Maxis', 'CelcomDigi', 'Astro']) expect(names).toContain(n);
  });

  test('usage based bills change monthly and subscriptions are fixed', () => {
    expect(billerFor('TNB')?.variable).toBe(true);
    expect(billerFor('Air Selangor')?.variable).toBe(true);
    expect(billerFor('Netflix')).toMatchObject({ kind: 'subscription', variable: false, category: 'Hiburan' });
  });

  test('matches by name, longer brands before shorter ones', () => {
    expect(billerFor('Unifi Home 300Mbps')?.id).toBe('unifi');
    expect(billerFor('unifi mobile')?.id).toBe('unifi-mobile');
    expect(billerFor('Maxis Fibre')?.id).toBe('maxis-fibre');
    expect(billerFor('Maxis postpaid')?.id).toBe('maxis');
    expect(billerFor('Celcom Digi')?.id).toBe('celcomdigi');
    expect(billerFor('CelcomDigi Home')?.id).toBe('celcomdigi-home');
    expect(billerFor('Mom\'s birthday')).toBeNull();
    expect(billerFor('Yesterday lunch')).toBeNull();
  });
});
