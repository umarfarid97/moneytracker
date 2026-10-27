import { brandForBill, brandForNote } from '@/domain/brandLookup';
import { BRAND_MARKS } from '@/ui/brandMarks';
import { SUBSCRIPTIONS } from '@/domain/subscriptions';
import { BILLERS } from '@/domain/billers';

describe('brandForBill', () => {
  it('matches subscriptions by what the user typed', () => {
    expect(brandForBill('Netflix Premium', 'subscription')?.id).toBe('netflix');
    expect(brandForBill('claude pro')?.id).toBe('claude');
    expect(brandForBill('YouTube Music')?.id).toBe('youtube');
  });
  it('matches billers and keeps Malaysian utilities as monograms', () => {
    const tnb = brandForBill('TNB bill March', 'bill');
    expect(tnb?.id).toBe('tnb');
    expect(BRAND_MARKS[tnb!.id]).toBeUndefined();
    expect(brandForBill('Unifi Home 300Mbps', 'bill')?.id).toBe('unifi');
  });
  it('returns null for custom names', () => {
    expect(brandForBill('Piano lessons')).toBeNull();
  });
});

describe('brandForNote', () => {
  it('badges notes that name a brand, not generic words', () => {
    expect(brandForNote('Spotify')?.id).toBe('spotify');
    expect(brandForNote('Gym shoes')).toBeNull();
    expect(brandForNote('Rent deposit')).toBeNull();
    expect(brandForNote('  ')).toBeNull();
  });
});

describe('bundled marks', () => {
  it('belong to real subscriptions and are single path strings', () => {
    const ids = new Set(SUBSCRIPTIONS.map((s) => s.id));
    for (const [id, d] of Object.entries(BRAND_MARKS)) {
      expect(ids.has(id)).toBe(true);
      expect(d.startsWith('M') || d.startsWith('m')).toBe(true);
    }
  });
});

describe('bill and loan badges', () => {
  it('gives every biller an icon', () => {
    for (const b of BILLERS) expect(b.icon).toBeTruthy();
    expect(brandForBill('TNB electricity', 'bill')?.icon).toBe('flash');
    expect(brandForBill('Air Selangor', 'bill')?.icon).toBe('water');
    expect(brandForBill('Unifi', 'bill')?.icon).toBe('wifi');
  });

  it('shows the lender with the loan type icon', () => {
    expect(brandForBill('Maybank car loan', 'loan', 'car')).toMatchObject({ id: 'maybank', icon: 'car' });
    expect(brandForBill('PTPTN', 'loan', 'ptptn')).toMatchObject({ id: 'ptptn', icon: 'school' });
  });

  it('falls back to a loan type tile when no lender is named', () => {
    expect(brandForBill('Kereta', 'loan', 'car')).toMatchObject({ id: 'loan-car', icon: 'car' });
    expect(brandForBill('Rumah', 'loan', 'home')).toMatchObject({ id: 'loan-home', icon: 'home' });
  });

  it('recognises a lender in a payment note only when it says loan', () => {
    expect(brandForNote('Maybank car loan')?.id).toBe('maybank');
    expect(brandForNote('Maybank transfer')).toBeNull();
  });
});
