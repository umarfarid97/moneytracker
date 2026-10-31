import { YA2025 } from '@/data/tax/ya2025';
import { buildReliefPack } from '@/domain/reliefPack';
import { auditTaxRecords, confirmedTaxPack, previewTaxSaving, reviewedFilingCsv, reviewKey, reviewTaxPack } from '@/domain/taxPreparation';
import { suggestReliefs } from '@/domain/taxGuide';
import type { ReliefClaim } from '@/domain/types';

const claim = (over: Partial<ReliefClaim> = {}): ReliefClaim => ({ id: 1, year: 2025, reliefId: 'lifestyle', amount: 100000, note: 'Phone', receiptUri: 'receipts/a.jpg', ...over });
const pack = (claims = [claim()], year = 2025) => buildReliefPack({ year, data: YA2025, expenses: [], manualClaims: claims });
const input = { salary: 8000000, freelanceGross: 0, businessGross: 0, allowableExpenses: 0, pcb: 0, zakat: 0, spouseRebate: false, reliefsTotal: 900000 };

test('review counts missing receipts, notes, potential duplicates and shared caps', () => {
  const p = pack([claim({ note: '', receiptUri: null }), claim({ id: 2 }), claim({ id: 3 })]);
  const r = reviewTaxPack(p, YA2025);
  expect(r.items).toBe(3);
  expect(r.issues.map(x => x.kind)).toEqual(expect.arrayContaining(['missing', 'note', 'duplicate', 'cap']));
});
test('confirmation depends on all record details and rule year; fallback cannot be confirmed', () => {
  const p = pack();
  const key = reviewKey(p, p.sections[0]);
  expect(confirmedTaxPack(p, YA2025, [key], []).sections).toHaveLength(1);
  const edited = pack([claim({ amount: 90000 })]);
  expect(confirmedTaxPack(edited, YA2025, [key], []).sections).toHaveLength(0);
  expect(confirmedTaxPack(pack([claim({ year: 2026 })], 2026), YA2025, [key], []).sections).toHaveLength(0);
});
test('duplicates need an acknowledgement, missing evidence cannot be confirmed', () => {
  const p = pack([claim(), claim({ id: 2 })]);
  const keys = p.sections.map(s => reviewKey(p, s));
  expect(confirmedTaxPack(p, YA2025, keys, []).sections).toHaveLength(0);
  expect(confirmedTaxPack(p, YA2025, keys, keys).sections).toHaveLength(1);
  const missing = pack([claim({ receiptUri: null })]);
  expect(confirmedTaxPack(missing, YA2025, [reviewKey(missing, missing.sections[0])], []).sections).toHaveLength(0);
});
test('malformed amounts and dates are review issues, not confirmed figures', () => {
  const p = pack([claim({ amount: -100 })]);
  expect(reviewTaxPack(p, YA2025).issues.some(x => x.kind === 'invalid')).toBe(true);
  expect(confirmedTaxPack(p, YA2025, [reviewKey(p, p.sections[0])], []).sections).toHaveLength(0);
});
test('guide suggests children-related categories only when selected and keeps core suggestions', () => {
  expect(suggestReliefs([], YA2025).map(x => x.id)).toContain('lifestyle');
  expect(suggestReliefs([], YA2025).map(x => x.id)).not.toContain('childcare');
  expect(suggestReliefs(['children'], YA2025).map(x => x.id)).toEqual(expect.arrayContaining(['childcare', 'sspn']));
});
test('savings applies relief caps and computes actual progressive tax difference', () => {
  const r = previewTaxSaving(input, [], 'lifestyle', 100000, YA2025);
  expect(r).toMatchObject({ eligible: 100000, saving: 19000 });
  expect(previewTaxSaving(input, [claim({ amount: 250000 })], 'lifestyle', 100000, YA2025).saving).toBe(0);
  expect(previewTaxSaving(input, [claim({ reliefId: 'education-self', amount: 700000 })], 'education-upskilling', 100000, YA2025).eligible).toBe(0);
  expect(previewTaxSaving({ ...input, salary: 1000000 }, [], 'lifestyle', 100000, YA2025).saving).toBe(0);
});
test('savings includes rebate threshold effects; expenses cannot create another child', () => {
  expect(previewTaxSaving({ ...input, salary: 4500000 }, [], 'lifestyle', 100000, YA2025).saving).toBe(46000);
  expect(previewTaxSaving(input, [claim({ reliefId: 'child-under-18', amount: 200000 })], 'child-under-18', 100000, YA2025)).toMatchObject({ eligible: 0, saving: 0 });
});
test('unknown and malformed imported records cannot silently disappear from readiness', () => {
  expect(auditTaxRecords(2025, YA2025, [], [claim({ reliefId: 'unknown' }), claim({ id: 2, amount: -20 })])).toBe(2);
  expect(auditTaxRecords(2025, YA2025, [], [claim({ year: 2024, reliefId: 'unknown' })])).toBe(0);
  const expense = { id: 3, date: '2025-02-30', amount: 500, reliefId: 'lifestyle', reliefAmount: null } as any;
  expect(auditTaxRecords(2025, YA2025, [expense], [])).toBe(1);
});
test('same receipt in another category invalidates previous confirmation and requires acknowledgement', () => {
  const original = pack();
  const key = reviewKey(original, original.sections[0]);
  const changed = pack([claim(), claim({ id: 2, reliefId: 'sports', note: 'Gym' })]);
  expect(confirmedTaxPack(changed, YA2025, [key], []).sections).toHaveLength(0);
  expect(reviewTaxPack(changed, YA2025).issues.filter(i => i.kind === 'duplicate')).toHaveLength(2);
});
test('reviewed CSV identifies partial scope, actual rules year and source', () => {
  const p = pack([claim(), claim({ id: 2, reliefId: 'sports', receiptUri: 'receipts/b.jpg', note: 'Gym' })]);
  const confirmed = confirmedTaxPack(p, YA2025, [reviewKey(p, p.sections[0])], []);
  const csv = reviewedFilingCsv(p, confirmed, YA2025);
  expect(csv).toContain('Reviewed categories,1,of,2');
  expect(csv).toContain('Rules year,2025');
  expect(csv).toContain(YA2025.reliefSourceUrl);
  expect(csv).toContain(YA2025.fetchedOn);
  expect(csv).toContain('Partial relief reference');
});
