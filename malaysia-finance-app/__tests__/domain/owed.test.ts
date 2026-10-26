import { balances, eventBalances, settleEvent, settleUp, splitByAmounts, splitEntries, splitEqually, totals, type OwedEntry } from '@/domain/owed';

let id = 0;
const entry = (person: string, kind: OwedEntry['kind'], amount: number, date = '2026-10-01', event = ''): OwedEntry => ({
  id: ++id, person, kind, amount, date, note: '', event,
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
});

describe('split with different amounts', () => {
  test('each person owes their own amount and the rest is mine', () => {
    const r = splitEntries({ total: 10000, others: ['Aina', 'Ben'], date: '2026-10-26', note: 'Dinner', event: 'Penang trip', amounts: { Aina: 2500, Ben: 4000 } });
    expect(r.mine).toBe(3500);
    expect(r.entries.map((e) => [e.person, e.amount, e.event])).toEqual([['Aina', 2500, 'Penang trip'], ['Ben', 4000, 'Penang trip']]);
  });

  test('amounts above the total are refused, zero amounts are skipped, repeated names add up', () => {
    expect(splitByAmounts(1000, [{ person: 'A', amount: 600 }, { person: 'B', amount: 500 }])).toBeNull();
    expect(splitByAmounts(1000, [{ person: 'A', amount: 0 }, { person: 'B', amount: 300 }])).toEqual({ mine: 700, shares: [{ person: 'B', amount: 300 }] });
    expect(splitByAmounts(1000, [{ person: 'Aina', amount: 200 }, { person: ' aina ', amount: 300 }])?.shares).toEqual([{ person: 'Aina', amount: 500 }]);
  });
});

describe('by event', () => {
  const all = [
    entry('Aina', 'lent', 5000, '2026-10-01', 'Penang trip'),
    entry('Ben', 'lent', 3000, '2026-10-01', 'Penang trip'),
    entry('Aina', 'repaid', 5000, '2026-10-02', 'penang trip'),
    entry('Aina', 'lent', 1000, '2026-10-03', 'Dinner'),
    entry('Chen', 'lent', 700),
  ];

  test('groups by event ignoring case, unsettled first, entries without an event last', () => {
    const list = eventBalances(all);
    expect(list.map((e) => [e.event, e.balance])).toEqual([['Penang trip', 3000], ['Dinner', 1000], ['', 700]]);
  });

  test('shows each person within an event', () => {
    const trip = eventBalances(all).find((e) => e.event === 'Penang trip')!;
    expect(trip.people).toEqual([{ person: 'Ben', balance: 3000 }, { person: 'Aina', balance: 0 }]);
  });

  test('settling an event pays back only what is owed for that event', () => {
    const trip = eventBalances(all).find((e) => e.event === 'Penang trip')!;
    expect(settleEvent(trip, '2026-10-26')).toEqual([
      { person: 'Ben', kind: 'repaid', amount: 3000, date: '2026-10-26', note: '', event: 'Penang trip' },
    ]);
  });
});
