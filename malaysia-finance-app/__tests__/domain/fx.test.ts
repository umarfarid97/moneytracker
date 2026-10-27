import { HOME_CURRENCY, rateToInput } from '@/domain/fx';

describe('older foreign spending', () => {
  test('the app is ringgit only', () => {
    expect(HOME_CURRENCY).toBe('MYR');
  });

  test('shows the rate it was converted at without trailing zeros', () => {
    expect(rateToInput(3.3)).toBe('3.3');
    expect(rateToInput(3.30001234)).toBe('3.3');
    expect(rateToInput(0.000289)).toBe('0.000289');
  });
});
