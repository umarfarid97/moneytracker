import { balances, eventSummaries, settleUp, splitBill, splitEntries, splitEqually, totals, type OwedEntry } from '@/domain/owed';

let id = 0;
const entry = (person: string, kind: OwedEntry['kind'], amount: number, date = '2026-10-01'): OwedEntry => ({
  id: ++id, person, kind, amount, date, note: '', event: '',
});

describe('who owes me', () => {
  test('a lent amount is owed until it is paid back', () => {
    const list = balances([entry('Aina', 'lent', 5000), entry('Aina', 'repaid', 2000, '2026-10-05')]);
    expect(list).toHaveLength(1);
    expect(list[0].balance).toBe(3000);
    expect(list[0].entries[0].kind).toBe('repaid');
  });

  test('borrowing goes the other way, and paying back brings it to zero', () => {
    const list = balances([entry('Ben', 'borrowed', 4000), entry('Ben', 'paidBack', 4000)]);
    expect(list[0].balance).toBe(0);
    const owing = balances([entry('Ben', 'borrowed', 4000)]);
    expect(owing[0].balance).toBe(-4000);
  });

  test('names match ignoring case and extra spaces', () => {
    const list = balances([entry('Aina ', 'lent', 1000), entry('aina', 'lent', 500), entry('Aina  Z', 'lent', 100)]);
    expect(list.map((p) => [p.person, p.balance])).toEqual([['Aina', 1500], ['Aina Z', 100]]);
  });

  test('settled people sort last and totals split by direction', () => {
    const list = balances([
      entry('Settled', 'lent', 100), entry('Settled', 'repaid', 100),
      entry('Big', 'lent', 9000), entry('Small', 'lent', 1000), entry('Me', 'borrowed', 2500),
    ]);
    expect(list.map((p) => p.person)).toEqual(['Big', 'Me', 'Small', 'Settled']);
    expect(totals(list)).toEqual({ owedToMe: 10000, iOwe: 2500 });
  });

  test('settling up cancels the balance in either direction', () => {
    const [owes] = balances([entry('A', 'lent', 3000)]);
    expect(settleUp(owes, '2026-10-26')).toMatchObject({ person: 'A', kind: 'repaid', amount: 3000, date: '2026-10-26' });
    const [iOwe] = balances([entry('B', 'borrowed', 700)]);
    expect(settleUp(iOwe, '2026-10-26')).toMatchObject({ kind: 'paidBack', amount: 700 });
    const [even] = balances([entry('C', 'lent', 5), entry('C', 'repaid', 5)]);
    expect(settleUp(even, '2026-10-26')).toBeNull();
  });

  test('a split gives every share in whole sen and the leftover sen to the payer', () => {
    expect(splitEqually(10000, ['A', 'B'])).toEqual({ share: 3333, mine: 3334 });
    const { mine, entries } = splitEntries({ total: 10000, others: ['A', 'b', 'A', ' '], date: '2026-10-26', note: 'Dinner' });
    expect(entries.map((e) => e.person)).toEqual(['A', 'b']);
    expect(entries.every((e) => e.kind === 'lent' && e.amount === 3333 && e.note === 'Dinner')).toBe(true);
    expect(mine + entries.reduce((s, e) => s + e.amount, 0)).toBe(10000);
  });

  test('splitting with nobody records nothing', () => {
    expect(splitEntries({ total: 500, others: [], date: '2026-10-26', note: '' }).entries).toEqual([]);
  });

  test('settling up inside an event keeps the entry in that event', () => {
    const [p] = balances([entry('A', 'lent', 3000)]);
    expect(settleUp(p, '2026-10-26', 'Penang trip')).toMatchObject({ kind: 'repaid', event: 'Penang trip' });
  });
});

describe('split with different parts', () => {
  const others = (...values: number[]) => values.map((value, i) => ({ name: ['A', 'B', 'C'][i], value }));

  test('different amounts: you keep what is left', () => {
    const r = splitBill({ total: 10000, mode: 'amount', others: others(2500, 4000) });
    expect(r.parts).toEqual([{ name: 'A', amount: 2500 }, { name: 'B', amount: 4000 }]);
    expect(r.mine).toBe(3500);
    expect(r.ok).toBe(true);
  });

  test('amounts that add up to more than the bill are not allowed', () => {
    const r = splitBill({ total: 10000, mode: 'amount', others: others(6000, 5000) });
    expect(r.mine).toBe(-1000);
    expect(r.ok).toBe(false);
  });

  test('percentages round to the sen and the total always matches', () => {
    const r = splitBill({ total: 10001, mode: 'percent', others: others(33.33, 33.33) });
    expect(r.parts.map((p) => p.amount)).toEqual([3333, 3333]);
    expect(r.mine + r.parts.reduce((s, p) => s + p.amount, 0)).toBe(10001);
    expect(r.ok).toBe(true);
    expect(splitBill({ total: 10000, mode: 'percent', others: others(60, 50) }).ok).toBe(false);
  });

  test('shares: you hold your own shares, and rounding sen stay with you', () => {
    const r = splitBill({ total: 10000, mode: 'shares', myShares: 1, others: others(2, 1) });
    expect(r.parts.map((p) => p.amount)).toEqual([5000, 2500]);
    expect(r.mine).toBe(2500);
    const odd = splitBill({ total: 10000, mode: 'shares', myShares: 1, others: others(1, 1) });
    expect(odd.parts.map((p) => p.amount)).toEqual([3333, 3333]);
    expect(odd.mine).toBe(3334);
  });

  test('a person with nothing to pay is not ok', () => {
    expect(splitBill({ total: 10000, mode: 'amount', others: others(0, 1000) }).ok).toBe(false);
  });

  test('entries carry the event and the custom amounts', () => {
    const { entries, mine } = splitEntries({
      total: 9000, others: ['A', 'B'], mode: 'amount', values: [2000, 3000], date: '2026-10-26', note: 'Hotel', event: 'Penang trip',
    });
    expect(entries.map((e) => [e.person, e.amount, e.event])).toEqual([['A', 2000, 'Penang trip'], ['B', 3000, 'Penang trip']]);
    expect(mine).toBe(4000);
  });
});

describe('events', () => {
  const ev = (person: string, kind: OwedEntry['kind'], amount: number, event: string, date: string): OwedEntry => ({
    ...entry(person, kind, amount, date), event,
  });

  test('groups per event with who owes what inside it, newest event first and no-event last', () => {
    const list = eventSummaries([
      ev('A', 'lent', 3000, 'Penang trip', '2026-10-10'),
      ev('B', 'lent', 2000, 'penang trip', '2026-10-11'),
      ev('A', 'repaid', 1000, 'Penang trip', '2026-10-12'),
      ev('A', 'lent', 500, 'Hari Raya dinner', '2026-10-20'),
      ev('A', 'lent', 100, '', '2026-10-25'),
    ]);
    expect(list.map((e) => e.event)).toEqual(['Hari Raya dinner', 'Penang trip', '']);
    const trip = list[1];
    expect(trip.owedToMe).toBe(4000);
    expect(trip.people.map((p) => [p.person, p.balance])).toEqual([['A', 2000], ['B', 2000]]);
  });

  test('a person owed in two events has one overall balance', () => {
    const entries = [ev('A', 'lent', 3000, 'Trip', '2026-10-10'), ev('A', 'lent', 500, 'Dinner', '2026-10-20')];
    expect(balances(entries)[0].balance).toBe(3500);
  });
});
