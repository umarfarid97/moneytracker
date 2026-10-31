import type { TaxYearData } from '@/data/tax/types';

export type GuideAnswer = 'children' | 'parents' | 'education' | 'insurance' | 'disability' | 'home';
export const GUIDE_ANSWERS: GuideAnswer[] = ['children', 'parents', 'education', 'insurance', 'disability', 'home'];
const groups: Record<GuideAnswer, string[]> = {
  children: ['child-under-18', 'child-fulltime-18', 'child-higher-ed', 'child-disabled', 'child-disabled-higher-ed', 'childcare', 'breastfeeding', 'sspn'],
  parents: ['parents-medical', 'parents-medical-exam'],
  education: ['education-self', 'education-upskilling'],
  insurance: ['life-insurance', 'insurance-edu-medical', 'prs'],
  disability: ['disabled-individual', 'disabled-equipment', 'spouse-disabled'],
  home: ['housing-interest-500k', 'housing-interest-750k', 'ev-charging'],
};
export function suggestReliefs(answers: GuideAnswer[], data: TaxYearData) {
  const ids = new Set(['lifestyle', 'sports', 'epf', 'socso', ...answers.flatMap(a => groups[a])]);
  return data.reliefs.filter(r => ids.has(r.id));
}

/** Source-linked prompts, not an eligibility determination. Conditions are scoped to YA2025. */
export function guideCondition(id: string): 'children' | 'childcare' | 'breastfeeding' | 'sspn' | 'parents' | 'education' | 'home' | 'lifestyle' | 'sports' | 'disability' | 'contributions' | 'general' {
  if (id.startsWith('child-')) return 'children';
  if (id === 'childcare') return 'childcare';
  if (id === 'breastfeeding') return 'breastfeeding';
  if (id === 'sspn') return 'sspn';
  if (id.startsWith('parents-')) return 'parents';
  if (id.startsWith('education-')) return 'education';
  if (id.startsWith('housing-')) return 'home';
  if (id === 'lifestyle') return 'lifestyle';
  if (id === 'sports') return 'sports';
  if (id.includes('disabled')) return 'disability';
  if (['epf', 'socso', 'prs', 'life-insurance', 'insurance-edu-medical'].includes(id)) return 'contributions';
  return 'general';
}
