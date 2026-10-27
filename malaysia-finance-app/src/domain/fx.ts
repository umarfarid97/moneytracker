/** The app is for Malaysia: every amount is in ringgit. Older spending logged in another currency keeps its original amount and rate. */
export const HOME_CURRENCY = 'MYR';

/** Rate text for showing the rate that older foreign spending was converted at: no trailing zeros, enough digits for small rates. */
export function rateToInput(rate: number): string {
  const digits = rate >= 1 ? 4 : rate >= 0.01 ? 5 : 6;
  return String(Number(rate.toFixed(digits)));
}
