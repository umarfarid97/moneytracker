import { matcher } from './brandMatch';
import type { CommitmentKind } from './types';

/**
 * Malaysian billers offered as ready-made bills. Like the banks in banks.ts they have no logo files:
 * each is a circle in a brand-like colour with its initials, and a bill is matched to a biller by its
 * name, so nothing extra is stored or synced.
 */
export type BillerGroup = 'utilities' | 'internet' | 'mobile' | 'tv' | 'insurance' | 'home';

export type Biller = {
  id: string;
  /** Name given to a new bill picked from the list. */
  name: string;
  group: BillerGroup;
  kind: CommitmentKind;
  /** The amount changes every month (usage based), so it is asked for when paying. */
  variable: boolean;
  /** Name of the category the bill is recorded under. */
  category: 'Bil' | 'Hiburan' | 'Rumah';
  initials: string;
  color: string;
  ink: string;
  aliases: string[];
};

export const BILLER_GROUPS: BillerGroup[] = ['utilities', 'internet', 'mobile', 'tv', 'insurance', 'home'];

const WHITE = '#ffffff';
const bill = (
  id: string, name: string, group: BillerGroup, initials: string, color: string, ink: string,
  o: Partial<Pick<Biller, 'variable' | 'kind' | 'category' | 'aliases'>> = {},
): Biller => ({
  id, name, group, initials, color, ink,
  kind: o.kind ?? 'bill', variable: o.variable ?? false, category: o.category ?? 'Bil', aliases: o.aliases ?? [],
});

/** Order matters for matching: the first biller whose name or alias appears wins. */
export const BILLERS: Biller[] = [
  bill('tnb', 'TNB electricity', 'utilities', 'TNB', '#e4002b', WHITE, { variable: true, aliases: ['tnb', 'tenaga nasional', 'tenaga', 'electricity bill'] }),
  bill('sesb', 'SESB electricity', 'utilities', 'SESB', '#00629b', WHITE, { variable: true, aliases: ['sesb', 'sabah electricity'] }),
  bill('sarawak-energy', 'Sarawak Energy', 'utilities', 'SE', '#00843d', WHITE, { variable: true, aliases: ['sarawak energy', 'sesco'] }),
  bill('air-selangor', 'Air Selangor', 'utilities', 'AS', '#0072bc', WHITE, { variable: true, aliases: ['air selangor', 'syabas', 'water bill'] }),
  bill('saj', 'Air Johor (SAJ)', 'utilities', 'SAJ', '#0b8ec6', WHITE, { variable: true, aliases: ['saj', 'ranhill', 'air johor'] }),
  bill('pba', 'PBAPP Penang water', 'utilities', 'PBA', '#1f7a8c', WHITE, { variable: true, aliases: ['pbapp', 'pba penang', 'penang water'] }),
  bill('indah-water', 'Indah Water', 'utilities', 'IWK', '#1b6ec2', WHITE, { aliases: ['iwk', 'indah water konsortium', 'sewerage'] }),
  bill('gas-malaysia', 'Gas Malaysia', 'utilities', 'GM', '#f58220', WHITE, { variable: true, aliases: ['gas malaysia', 'piped gas'] }),

  bill('unifi-mobile', 'Unifi Mobile', 'mobile', 'UM', '#f26522', WHITE, { aliases: ['unifi mobile'] }),
  bill('unifi', 'Unifi', 'internet', 'U', '#f26522', WHITE, { aliases: ['unifi home', 'unifi fibre', 'tm unifi', 'telekom malaysia', 'streamyx'] }),
  bill('maxis-fibre', 'Maxis Fibre', 'internet', 'MF', '#6cb33f', WHITE, { aliases: ['maxis home', 'maxis broadband'] }),
  bill('time', 'TIME Fibre', 'internet', 'T', '#d71920', WHITE, { aliases: ['time internet', 'time dotcom', 'time fibre'] }),
  bill('celcomdigi-home', 'CelcomDigi Home', 'internet', 'CD', '#ffd100', '#0a2a66', { aliases: ['celcom home', 'celcomdigi fibre', 'celcomdigi home'] }),

  bill('maxis', 'Maxis', 'mobile', 'M', '#6cb33f', WHITE, { aliases: ['maxis postpaid', 'hotlink'] }),
  bill('celcomdigi', 'CelcomDigi', 'mobile', 'CD', '#ffd100', '#0a2a66', { aliases: ['celcom', 'digi', 'celcom digi', 'digi postpaid'] }),
  bill('umobile', 'U Mobile', 'mobile', 'U', '#f7941d', WHITE, { aliases: ['u mobile', 'umobile', 'u mobile postpaid'] }),
  bill('yes', 'Yes 5G', 'mobile', 'Y', '#ffc20e', '#1a1a1a', { aliases: ['yes', 'yes 4g'] }),
  bill('redone', 'redONE', 'mobile', 'r1', '#e31837', WHITE, { aliases: ['red one'] }),

  bill('astro', 'Astro', 'tv', 'A', '#0033a0', WHITE, { aliases: ['astro njoi', 'astro tv', 'astro go', 'astro fibre'], category: 'Hiburan' }),
  bill('netflix', 'Netflix', 'tv', 'N', '#e50914', WHITE, { kind: 'subscription', category: 'Hiburan' }),
  bill('disney', 'Disney+ Hotstar', 'tv', 'D+', '#113ccf', WHITE, { kind: 'subscription', category: 'Hiburan', aliases: ['disney plus', 'disney', 'hotstar'] }),
  bill('spotify', 'Spotify', 'tv', 'S', '#1db954', '#111111', { kind: 'subscription', category: 'Hiburan' }),
  bill('youtube', 'YouTube Premium', 'tv', 'YT', '#ff0000', WHITE, { kind: 'subscription', category: 'Hiburan', aliases: ['youtube'] }),

  bill('aia', 'AIA', 'insurance', 'AIA', '#d31145', WHITE, { aliases: ['aia public takaful', 'aia insurance'] }),
  bill('great-eastern', 'Great Eastern', 'insurance', 'GE', '#e30613', WHITE, { aliases: ['great eastern life', 'ge life'] }),
  bill('prudential', 'Prudential', 'insurance', 'PRU', '#ed1b2e', WHITE, { aliases: ['pru', 'prudential bsn', 'pru bsn'] }),
  bill('allianz', 'Allianz', 'insurance', 'AZ', '#003781', WHITE, { aliases: ['allianz life'] }),
  bill('takaful', 'Takaful Malaysia', 'insurance', 'TM', '#00a651', WHITE, { aliases: ['takaful ikhlas', 'syarikat takaful', 'takaful'] }),

  bill('rent', 'House rent', 'home', 'R', '#475569', WHITE, { category: 'Rumah', aliases: ['rent', 'sewa rumah', 'rental'] }),
  bill('maintenance', 'Maintenance fee', 'home', 'MF', '#64748b', WHITE, { category: 'Rumah', aliases: ['maintenance', 'management fee', 'sinking fund', 'yuran penyelenggaraan'] }),
  bill('assessment', 'Quit rent and assessment', 'home', 'QR', '#7c6f64', WHITE, { category: 'Rumah', aliases: ['cukai pintu', 'cukai tanah', 'quit rent', 'assessment tax'] }),
];

/** The biller a bill's name refers to (so "Maxis Fibre 300Mbps" is Maxis Fibre), or null for custom names. */
export const billerFor = matcher(BILLERS);

export const billersIn = (group: BillerGroup): Biller[] => BILLERS.filter((b) => b.group === group);
