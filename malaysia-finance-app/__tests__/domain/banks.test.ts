import { BRANDS, brandFor } from '@/domain/banks';

describe('brandFor', () => {
  test.each([
    ['Maybank', 'maybank'],
    ['Maybank Visa', 'maybank'],
    ['maybank2u', 'maybank'],
    ['MAE', 'mae'],
    ['Maybank MAE', 'mae'],
    ["Touch 'n Go eWallet", 'tng'],
    ['TNG', 'tng'],
    ['Grab Pay', 'grabpay'],
    ['CIMB Octo', 'cimb'],
    ['Hong Leong Bank', 'hongleong'],
    ['Bank Islam', 'bankislam'],
    ['DuitNow QR', 'duitnow'],
  ])('%s is %s', (name, id) => expect(brandFor(name)?.id).toBe(id));

  test('Cash, cards and custom names have no brand', () => {
    for (const n of ['Cash', 'Debit card', 'Credit card', 'E-wallet', 'Online transfer', 'Piggy bank']) expect(brandFor(n)).toBeNull();
  });

  test('names fit the 24 character limit and ids are unique', () => {
    expect(BRANDS.every((b) => b.name.length <= 24)).toBe(true);
    expect(new Set(BRANDS.map((b) => b.id)).size).toBe(BRANDS.length);
  });
});
