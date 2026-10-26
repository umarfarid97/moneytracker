import type { PaymentKind } from './types';

/**
 * Malaysian banks and e-wallets offered as ready-made payment methods. They have no logo files:
 * each is drawn as a circle in the brand's colour with its initials, so nothing trademarked is bundled.
 * A method is matched to a brand by its name, so no extra column is stored or synced, and a
 * custom name such as "Maybank Visa" still gets the Maybank badge.
 */
export type Brand = {
  id: string;
  /** Name given to a new method picked from the list. Up to 24 characters. */
  name: string;
  kind: PaymentKind;
  /** Short text on the badge. */
  initials: string;
  /** Badge colour and the colour of the initials on it. */
  color: string;
  ink: string;
  /** Other ways people write the name, matched as whole words after normalising. */
  aliases: string[];
};

const WHITE = '#ffffff';

/**
 * Order matters for matching: the first brand whose name or alias appears wins, so MAE comes
 * before Maybank ("Maybank MAE" is MAE) and e-wallets come before the banks.
 */
export const BRANDS: Brand[] = [
  { id: 'tng', name: "Touch 'n Go eWallet", kind: 'ewallet', initials: 'TNG', color: '#005abb', ink: WHITE, aliases: ['touch n go', 'touchngo', 'tng', 'tng ewallet', 'tngo'] },
  { id: 'grabpay', name: 'GrabPay', kind: 'ewallet', initials: 'G', color: '#00b14f', ink: WHITE, aliases: ['grab pay', 'grab'] },
  { id: 'boost', name: 'Boost', kind: 'ewallet', initials: 'B', color: '#ee2e24', ink: WHITE, aliases: [] },
  { id: 'shopeepay', name: 'ShopeePay', kind: 'ewallet', initials: 'SP', color: '#ee4d2d', ink: WHITE, aliases: ['shopee pay', 'shopee', 'spaylater'] },
  { id: 'mae', name: 'MAE', kind: 'ewallet', initials: 'MAE', color: '#111111', ink: '#ffc72c', aliases: ['mae by maybank'] },
  { id: 'duitnow', name: 'DuitNow', kind: 'transfer', initials: 'DN', color: '#e6007e', ink: WHITE, aliases: ['duit now', 'duitnow qr'] },
  { id: 'maybank', name: 'Maybank', kind: 'debit', initials: 'MB', color: '#ffc72c', ink: '#111111', aliases: ['malayan banking', 'maybank2u', 'm2u'] },
  { id: 'cimb', name: 'CIMB', kind: 'debit', initials: 'CIMB', color: '#ec1c24', ink: WHITE, aliases: ['cimb bank', 'cimb clicks', 'octo'] },
  { id: 'publicbank', name: 'Public Bank', kind: 'debit', initials: 'PB', color: '#d71920', ink: WHITE, aliases: ['pbb', 'pbe', 'pb engage', 'public bank berhad'] },
  { id: 'rhb', name: 'RHB', kind: 'debit', initials: 'RHB', color: '#005eb8', ink: WHITE, aliases: ['rhb bank'] },
  { id: 'hongleong', name: 'Hong Leong Bank', kind: 'debit', initials: 'HL', color: '#002d72', ink: WHITE, aliases: ['hong leong', 'hlb', 'hlbb', 'hong leong connect'] },
  { id: 'ambank', name: 'AmBank', kind: 'debit', initials: 'Am', color: '#e31b23', ink: '#ffd200', aliases: ['am bank', 'amonline'] },
  { id: 'bankislam', name: 'Bank Islam', kind: 'debit', initials: 'BI', color: '#a6192e', ink: WHITE, aliases: ['bimb', 'be u', 'beu'] },
  { id: 'bsn', name: 'BSN', kind: 'debit', initials: 'BSN', color: '#0052a5', ink: WHITE, aliases: ['bank simpanan nasional', 'mybsn'] },
  { id: 'bankrakyat', name: 'Bank Rakyat', kind: 'debit', initials: 'BR', color: '#00529b', ink: WHITE, aliases: ['irakyat'] },
  { id: 'ocbc', name: 'OCBC', kind: 'debit', initials: 'OCBC', color: '#e2231a', ink: WHITE, aliases: ['ocbc bank'] },
  { id: 'uob', name: 'UOB', kind: 'debit', initials: 'UOB', color: '#0b3b8c', ink: WHITE, aliases: ['uob bank', 'uob tmrw', 'tmrw'] },
  { id: 'hsbc', name: 'HSBC', kind: 'debit', initials: 'HSBC', color: '#db0011', ink: WHITE, aliases: ['hsbc bank', 'hsbc amanah'] },
  { id: 'affin', name: 'Affin Bank', kind: 'debit', initials: 'AF', color: '#003b71', ink: WHITE, aliases: ['affin', 'affin islamic', 'affinmax'] },
  { id: 'alliance', name: 'Alliance Bank', kind: 'debit', initials: 'AB', color: '#00609c', ink: WHITE, aliases: ['alliance', 'allianceonline'] },
  { id: 'muamalat', name: 'Bank Muamalat', kind: 'debit', initials: 'BM', color: '#5c2d91', ink: WHITE, aliases: ['muamalat'] },
  { id: 'agrobank', name: 'Agrobank', kind: 'debit', initials: 'AG', color: '#009a44', ink: WHITE, aliases: ['agro bank', 'bank pertanian'] },
  { id: 'stanchart', name: 'Standard Chartered', kind: 'credit', initials: 'SC', color: '#0473ea', ink: WHITE, aliases: ['stanchart', 'scb'] },
  { id: 'gxbank', name: 'GXBank', kind: 'debit', initials: 'GX', color: '#6c2bd9', ink: WHITE, aliases: ['gx bank', 'gx'] },
];

/** Lower case, "&" and apostrophes dropped, anything else that is not a letter or digit as a space. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’&]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const MATCHERS = BRANDS.map((brand) => ({
  brand,
  words: [brand.name, ...brand.aliases].map((n) => ` ${normalise(n)} `),
}));

/** The bank or e-wallet a payment method's name refers to, or null for Cash, cards and custom names. */
export function brandFor(name: string): Brand | null {
  const padded = ` ${normalise(name)} `;
  for (const { brand, words } of MATCHERS) {
    if (words.some((w) => padded.includes(w))) return brand;
  }
  return null;
}
