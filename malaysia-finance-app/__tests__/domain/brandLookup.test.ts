import { brandForBill, brandForNote } from '@/domain/brandLookup';
import { BRAND_MARKS } from '@/ui/brandMarks';
import { SUBSCRIPTIONS } from '@/domain/subscriptions';

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
