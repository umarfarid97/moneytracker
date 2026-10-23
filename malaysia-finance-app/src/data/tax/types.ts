import type { Sen } from '@/domain/money';

export type Bracket = {
  /** Upper bound of the band in sen, or null for the top band. */
  upTo: Sen | null;
  ratePct: number;
};

export type ReliefDef = {
  id: string;
  name: string;
  limit: Sen;
  /** Reliefs sharing a group also share `groupLimit` in total. */
  group?: string;
  groupLimit?: Sen;
  /** When true the limit applies to each claim (e.g. one claim per child), not to the total. */
  perItem?: boolean;
  requiresReceipt: boolean;
  note?: string;
};

export type TaxYearData = {
  ya: number;
  rateSourceUrl: string;
  reliefSourceUrl: string;
  /** Date (YYYY-MM-DD) the figures were read from LHDN. */
  fetchedOn: string;
  brackets: Bracket[];
  /** Rebates apply when chargeable income does not exceed this. */
  rebateThreshold: Sen;
  rebateAmount: Sen;
  spouseRebate: Sen;
  /** Reliefs every resident individual gets without claiming. */
  automaticReliefs: { id: string; name: string; amount: Sen }[];
  reliefs: ReliefDef[];
};
