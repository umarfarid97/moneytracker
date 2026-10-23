import { capReliefClaims } from '@/domain/reliefs';
import { YA2025 } from '@/data/tax/ya2025';
import type { ReliefClaim } from '@/domain/types';

const claim = (reliefId: string, amount: number, receiptUri: string | null = 'file://r.jpg'): ReliefClaim => ({
  id: Math.random(), reliefId, year: 2025, amount, receiptUri, note: '',
});
const cap = (claims: ReliefClaim[]) => capReliefClaims(claims, YA2025.reliefs);

describe('YA2025 relief data', () => {
  test('every relief has a unique id, a positive limit and a name', () => {
    const ids = YA2025.reliefs.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    YA2025.reliefs.forEach((r) => {
      expect(r.limit).toBeGreaterThan(0);
      expect(r.name.length).toBeGreaterThan(0);
    });
  });
  test('automatic self relief is RM 9,000', () => {
    expect(YA2025.automaticReliefs).toEqual([{ id: 'self', name: 'Individual and dependent relatives', amount: 900000 }]);
  });
  test('headline limits match the LHDN page', () => {
    const limit = (id: string) => YA2025.reliefs.find((r) => r.id === id)!.limit;
    expect(limit('lifestyle')).toBe(250000);
    expect(limit('sports')).toBe(100000);
    expect(limit('parents-medical')).toBe(800000);
    expect(limit('disabled-individual')).toBe(700000);
    expect(limit('education-self')).toBe(700000);
    expect(limit('sspn')).toBe(800000);
    expect(limit('spouse')).toBe(400000);
    expect(limit('prs')).toBe(300000);
    expect(limit('socso')).toBe(35000);
  });
});

describe('capReliefClaims', () => {
  test('a claim over its limit is capped', () => {
    const r = cap([claim('lifestyle', 300000)]);
    expect(r.perRelief.lifestyle).toEqual({ claimed: 300000, allowed: 250000 });
    expect(r.total).toBe(250000);
  });
  test('several claims for one relief add up before the cap', () => {
    const r = cap([claim('lifestyle', 150000), claim('lifestyle', 150000)]);
    expect(r.perRelief.lifestyle).toEqual({ claimed: 300000, allowed: 250000 });
  });
  test('per-child reliefs are capped per claim, not in total', () => {
    const r = cap([claim('child-under-18', 200000, null), claim('child-under-18', 200000, null), claim('child-under-18', 350000, null)]);
    expect(r.perRelief['child-under-18'].allowed).toBe(600000);
  });
  test('grouped reliefs never exceed the group limit', () => {
    const r = cap([claim('medical-serious', 1000000), claim('medical-checkup', 100000), claim('child-intervention', 600000)]);
    const used = r.perRelief['medical-serious'].allowed + r.perRelief['medical-checkup'].allowed + r.perRelief['child-intervention'].allowed;
    expect(used).toBe(1000000);
  });
  test('housing loan interest tiers share the RM 7,000 group limit', () => {
    const r = cap([claim('housing-interest-500k', 700000), claim('housing-interest-750k', 500000)]);
    expect(r.total).toBe(700000);
  });
  test('a receipt-required relief without a photo is listed once as missing', () => {
    const r = cap([claim('lifestyle', 10000, null), claim('lifestyle', 5000, null)]);
    expect(r.missingReceipts).toEqual(['lifestyle']);
  });
  test('a relief with a receipt is not listed, and EPF never needs one', () => {
    const r = cap([claim('lifestyle', 10000), claim('epf', 400000, null)]);
    expect(r.missingReceipts).toEqual([]);
  });
  test('unknown relief ids are ignored', () => {
    const r = cap([claim('does-not-exist', 999)]);
    expect(r.total).toBe(0);
    expect(r.perRelief).toEqual({});
  });
  test('no claims gives zeros', () => {
    expect(cap([])).toEqual({ perRelief: {}, total: 0, missingReceipts: [] });
  });
});

describe('medical relief sub-caps (review finding: dental and vaccination are RM 1,000 each)', () => {
  test('dental and vaccination are separate reliefs capped at RM 1,000, inside the RM 10,000 medical group', () => {
    const limit = (id: string) => YA2025.reliefs.find((r) => r.id === id)?.limit;
    expect(limit('medical-dental')).toBe(100000);
    expect(limit('medical-vaccination')).toBe(100000);
    const r = cap([claim('medical-dental', 300000), claim('medical-vaccination', 250000)]);
    expect(r.perRelief['medical-dental'].allowed).toBe(100000);
    expect(r.perRelief['medical-vaccination'].allowed).toBe(100000);
    expect(r.total).toBe(200000);
  });
  test('the whole medical group still stops at RM 10,000', () => {
    const r = cap([
      claim('medical-serious', 950000), claim('medical-dental', 100000), claim('medical-vaccination', 100000),
    ]);
    expect(r.total).toBe(1000000);
  });
});
