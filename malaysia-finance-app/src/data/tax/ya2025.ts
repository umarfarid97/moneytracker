import type { TaxYearData } from './types';

/**
 * Year of Assessment 2025 (resident individuals), read from LHDN on 2026-10-24.
 * Rates: the "YA 2023, 2024 & 2025" table. Reliefs: the "Year of Assessment 2025" table.
 * To add a new year: copy this file, update the figures from the two URLs below, register it in index.ts.
 * Amounts are in sen (RM x 100).
 */
const RM = (n: number) => n * 100;

export const YA2025: TaxYearData = {
  ya: 2025,
  rateSourceUrl: 'https://www.hasil.gov.my/en/individu/kadar-cukai/',
  reliefSourceUrl: 'https://www.hasil.gov.my/en/individu/pelepasan-cukai/',
  fetchedOn: '2026-10-24',
  brackets: [
    { upTo: RM(5_000), ratePct: 0 },
    { upTo: RM(20_000), ratePct: 1 },
    { upTo: RM(35_000), ratePct: 3 },
    { upTo: RM(50_000), ratePct: 6 },
    { upTo: RM(70_000), ratePct: 11 },
    { upTo: RM(100_000), ratePct: 19 },
    { upTo: RM(400_000), ratePct: 25 },
    { upTo: RM(600_000), ratePct: 26 },
    { upTo: RM(2_000_000), ratePct: 28 },
    { upTo: null, ratePct: 30 },
  ],
  // LHDN rebates page: RM400 for the individual and RM400 for the spouse (when the spouse has no income),
  // for resident individuals with low chargeable income (Income Tax Act s6A: not exceeding RM35,000).
  rebateThreshold: RM(35_000),
  rebateAmount: RM(400),
  spouseRebate: RM(400),
  automaticReliefs: [{ id: 'self', name: 'Individual and dependent relatives', amount: RM(9_000) }],
  reliefs: [
    { id: 'parents-medical', name: 'Parents/grandparents: medical, dental, special needs, carer', limit: RM(8_000), group: 'parents', groupLimit: RM(8_000), requiresReceipt: true },
    { id: 'parents-medical-exam', name: 'Parents/grandparents: complete medical examination', limit: RM(1_000), group: 'parents', groupLimit: RM(8_000), requiresReceipt: true },
    { id: 'disabled-equipment', name: 'Basic supporting equipment for disabled self, spouse, child or parent', limit: RM(6_000), requiresReceipt: true },
    { id: 'disabled-individual', name: 'Disabled individual', limit: RM(7_000), requiresReceipt: false },
    { id: 'education-self', name: 'Education fees (self)', limit: RM(7_000), group: 'education', groupLimit: RM(7_000), requiresReceipt: true },
    { id: 'education-upskilling', name: 'Education: upskilling or self-enhancement course', limit: RM(2_000), group: 'education', groupLimit: RM(7_000), requiresReceipt: true },
    { id: 'medical-serious', name: 'Medical: serious diseases and fertility treatment', limit: RM(10_000), group: 'medical', groupLimit: RM(10_000), requiresReceipt: true, note: 'LHDN lists RM10,000 on each medical line; this app shares one RM10,000 total across them to avoid over-claiming.' },
    { id: 'medical-vaccination', name: 'Medical: vaccination (self, spouse, child)', limit: RM(1_000), group: 'medical', groupLimit: RM(10_000), requiresReceipt: true },
    { id: 'medical-dental', name: 'Medical: dental examination and treatment', limit: RM(1_000), group: 'medical', groupLimit: RM(10_000), requiresReceipt: true },
    { id: 'medical-checkup', name: 'Medical: check-up, COVID test, mental health, monitoring equipment', limit: RM(1_000), group: 'medical', groupLimit: RM(10_000), requiresReceipt: true },
    { id: 'child-intervention', name: 'Child 18 and below: intellectual disability assessment or early intervention', limit: RM(6_000), group: 'medical', groupLimit: RM(10_000), requiresReceipt: true },
    { id: 'lifestyle', name: 'Lifestyle: books, computer/phone/tablet, internet, skill courses', limit: RM(2_500), requiresReceipt: true },
    { id: 'sports', name: 'Lifestyle (additional): sports equipment, facilities, gym, competitions', limit: RM(1_000), requiresReceipt: true },
    { id: 'breastfeeding', name: 'Breastfeeding equipment (once every 2 years)', limit: RM(1_000), requiresReceipt: true },
    { id: 'childcare', name: 'Child care / kindergarten fees (child 6 and below)', limit: RM(3_000), requiresReceipt: true },
    { id: 'sspn', name: 'SSPN net deposit', limit: RM(8_000), requiresReceipt: false },
    { id: 'spouse', name: 'Husband / wife / alimony to former wife', limit: RM(4_000), requiresReceipt: false },
    { id: 'spouse-disabled', name: 'Disabled husband / wife', limit: RM(6_000), requiresReceipt: false },
    { id: 'child-under-18', name: 'Unmarried child under 18 (per child)', limit: RM(2_000), perItem: true, requiresReceipt: false },
    { id: 'child-fulltime-18', name: 'Unmarried child 18+ in A-Level, certificate or matriculation (per child)', limit: RM(2_000), perItem: true, requiresReceipt: false },
    { id: 'child-higher-ed', name: 'Unmarried child 18+ in diploma or degree (per child)', limit: RM(8_000), perItem: true, requiresReceipt: false },
    { id: 'child-disabled', name: 'Disabled child (per child)', limit: RM(8_000), perItem: true, requiresReceipt: false },
    { id: 'child-disabled-higher-ed', name: 'Disabled child 18+ in diploma or degree: additional (per child)', limit: RM(8_000), perItem: true, requiresReceipt: false },
    { id: 'epf', name: 'EPF / approved pension scheme contributions', limit: RM(4_000), group: 'life-epf', groupLimit: RM(7_000), requiresReceipt: false },
    { id: 'life-insurance', name: 'Life insurance / family takaful / extra voluntary EPF', limit: RM(3_000), group: 'life-epf', groupLimit: RM(7_000), requiresReceipt: true },
    { id: 'prs', name: 'Deferred annuity and Private Retirement Scheme (PRS)', limit: RM(3_000), requiresReceipt: true },
    { id: 'insurance-edu-medical', name: 'Insurance premium for education or medical benefit', limit: RM(4_000), requiresReceipt: true },
    { id: 'socso', name: 'SOCSO contribution', limit: RM(350), requiresReceipt: false },
    { id: 'ev-charging', name: 'EV charging facilities / food waste composting machine', limit: RM(2_500), requiresReceipt: true },
    { id: 'housing-interest-500k', name: 'First home loan interest: house up to RM500,000', limit: RM(7_000), group: 'housing', groupLimit: RM(7_000), requiresReceipt: true, note: 'Sale and purchase agreement signed 1 Jan 2025 to 31 Dec 2027.' },
    { id: 'housing-interest-750k', name: 'First home loan interest: house RM500,001 to RM750,000', limit: RM(5_000), group: 'housing', groupLimit: RM(7_000), requiresReceipt: true, note: 'Sale and purchase agreement signed 1 Jan 2025 to 31 Dec 2027.' },
  ],
};
