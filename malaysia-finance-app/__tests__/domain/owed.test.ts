import { balances, entryOf, netPositions, participants, settleTransfers, splitTransfers, transferOf, projectSummaries, settleUp, splitBill, splitEntries, splitEqually, totals, type OwedEntry, type OwedProject } from '@/domain/owed';

let id = 0;
const entry = (person: string, kind: OwedEntry['kind'], amount: number, date = '2026-10-01'): OwedEntry => ({
  id: ++id, person, kind, amount, date, note: '', projectId: 1, counter: '',
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
    expect(settleUp(owes, '2026-10-26', 1)).toMatchObject({ person: 'A', kind: 'repaid', amount: 3000, date: '2026-10-26' });
    const [iOwe] = balances([entry('B', 'borrowed', 700)]);
    expect(settleUp(iOwe, '2026-10-26', 1)).toMatchObject({ kind: 'paidBack', amount: 700 });
    const [even] = balances([entry('C', 'lent', 5), entry('C', 'repaid', 5)]);
    expect(settleUp(even, '2026-10-26', 1)).toBeNull();
  });

  test('a split gives every share in whole sen and the leftover sen to the payer', () => {
    expect(splitEqually(10000, ['A', 'B'])).toEqual({ share: 3333, mine: 3334 });
    const { mine, entries } = splitEntries({ total: 10000, others: ['A', 'b', 'A', ' '], date: '2026-10-26', note: 'Dinner', projectId: 1 });
    expect(entries.map((e) => e.person)).toEqual(['A', 'b']);
    expect(entries.every((e) => e.kind === 'lent' && e.amount === 3333 && e.note === 'Dinner')).toBe(true);
    expect(mine + entries.reduce((s, e) => s + e.amount, 0)).toBe(10000);
  });

  test('splitting with nobody records nothing', () => {
    expect(splitEntries({ total: 500, others: [], date: '2026-10-26', note: '', projectId: 1 }).entries).toEqual([]);
  });

  test('settling up inside a project keeps the entry in that project', () => {
    const [p] = balances([entry('A', 'lent', 3000)]);
    expect(settleUp(p, '2026-10-26', 7)).toMatchObject({ kind: 'repaid', projectId: 7 });
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

  test('entries carry the project and the custom amounts', () => {
    const { entries, mine } = splitEntries({
      total: 9000, others: ['A', 'B'], mode: 'amount', values: [2000, 3000], date: '2026-10-26', note: 'Hotel', projectId: 9,
    });
    expect(entries.map((e) => [e.person, e.amount, e.projectId])).toEqual([['A', 2000, 9], ['B', 3000, 9]]);
    expect(mine).toBe(4000);
  });
});

describe('projects', () => {
  const project = (id: number, name: string, over: Partial<OwedProject> = {}): OwedProject => ({
    id, uid: id === 1 ? 'proj-general' : `p${id}`, name, startDate: null, endDate: null, members: [], owner: '', ...over,
  });
  const inProject = (projectId: number, person: string, kind: OwedEntry['kind'], amount: number, date: string): OwedEntry => ({
    ...entry(person, kind, amount, date), projectId,
  });

  test('summaries hold who owes what inside each project, newest first and the default project last', () => {
    const list = projectSummaries(
      [project(1, 'General'), project(2, 'Penang trip'), project(3, 'Hari Raya dinner'), project(4, 'Empty')],
      [
        inProject(2, 'A', 'lent', 3000, '2026-10-10'),
        inProject(2, 'B', 'lent', 2000, '2026-10-11'),
        inProject(2, 'A', 'repaid', 1000, '2026-10-12'),
        inProject(3, 'A', 'lent', 500, '2026-10-20'),
        inProject(1, 'A', 'lent', 100, '2026-10-25'),
      ],
    );
    expect(list.map((s) => s.project.name)).toEqual(['Hari Raya dinner', 'Penang trip', 'Empty', 'General']);
    const trip = list[1];
    expect(trip.owedToMe).toBe(4000);
    expect(trip.people.map((p) => [p.person, p.balance])).toEqual([['A', 2000], ['B', 2000]]);
  });

  test('a person owed in two projects has one overall balance', () => {
    const entries = [inProject(2, 'A', 'lent', 3000, '2026-10-10'), inProject(3, 'A', 'lent', 500, '2026-10-20')];
    expect(balances(entries)[0].balance).toBe(3500);
  });

  test('people in a project are its members plus anyone with an entry, once each', () => {
    const p = project(2, 'Trip', { members: ['Aina', 'ben'] });
    const names = participants(p, [inProject(2, 'Ben', 'lent', 100, '2026-10-01'), inProject(2, 'Chen', 'lent', 100, '2026-10-01'), inProject(3, 'Zed', 'lent', 100, '2026-10-01')]);
    expect(names).toEqual(['Aina', 'ben', 'Chen']);
  });
});

describe('who paid whom', () => {
  const between = (person: string, kind: OwedEntry['kind'], amount: number, counter: string): OwedEntry => ({ ...entry(person, kind, amount), counter });

  test('every entry reads as money moving from one person to another and back again', () => {
    for (const kind of ['lent', 'repaid', 'borrowed', 'paidBack'] as const) {
      for (const counter of ['', 'Ben']) {
        const e = between('Aina', kind, 500, counter);
        const t = transferOf(e);
        expect(entryOf(t)).toMatchObject({ amount: 500 });
        expect(transferOf({ ...entryOf(t) })).toEqual(t);
      }
    }
    expect(transferOf(between('Aina', 'lent', 500, ''))).toEqual({ from: '', to: 'Aina', type: 'lend', amount: 500 });
    expect(transferOf(between('Aina', 'borrowed', 500, ''))).toEqual({ from: 'Aina', to: '', type: 'lend', amount: 500 });
    expect(entryOf({ from: 'Ben', to: 'Aina', type: 'lend', amount: 500 })).toEqual({ person: 'Aina', kind: 'lent', counter: 'Ben', amount: 500 });
    expect(entryOf({ from: 'Aina', to: '', type: 'payback', amount: 500 })).toEqual({ person: 'Aina', kind: 'repaid', counter: '', amount: 500 });
  });

  test('net positions add up to zero and agree with the per-person balances', () => {
    const list = [between('Aina', 'lent', 3000, ''), between('Ben', 'lent', 2000, ''), between('Aina', 'repaid', 1000, ''), between('Ben', 'lent', 900, 'Aina')];
    const net = netPositions(list);
    expect(net.reduce((s, p) => s + p.net, 0)).toBe(0);
    expect(net.find((p) => p.name === '')?.net).toBe(4000);
    expect(net.find((p) => p.name === 'Aina')?.net).toBe(-2000 + 900);
  });

  test('settling needs no more payments than people, and leaves everyone at zero', () => {
    const net = [{ name: 'A', net: 50 }, { name: 'B', net: 30 }, { name: 'C', net: -45 }, { name: 'D', net: -35 }];
    const pays = settleTransfers(net);
    expect(pays.length).toBeLessThanOrEqual(3);
    const after = new Map(net.map((p) => [p.name, p.net]));
    for (const t of pays) {
      after.set(t.from, after.get(t.from)! + t.amount);
      after.set(t.to, after.get(t.to)! - t.amount);
    }
    expect([...after.values()]).toEqual([0, 0, 0, 0]);
    expect(settleTransfers([])).toEqual([]);
  });

  test('a bill paid by someone else makes the others owe that person', () => {
    const t = splitTransfers({ paid: [{ name: 'Aina', amount: 9000 }], parts: [{ name: 'Aina', amount: 3000 }, { name: 'Ben', amount: 3000 }], mine: 3000 });
    expect(t).toEqual([
      { from: 'Aina', to: '', type: 'lend', amount: 3000 },
      { from: 'Aina', to: 'Ben', type: 'lend', amount: 3000 },
    ]);
  });

  test('a bill I paid makes each person owe me their part, and several payers net out', () => {
    expect(splitTransfers({ paid: [{ name: '', amount: 10000 }], parts: [{ name: 'Aina', amount: 2500 }, { name: 'Ben', amount: 4000 }], mine: 3500 })).toEqual([
      { from: '', to: 'Ben', type: 'lend', amount: 4000 },
      { from: '', to: 'Aina', type: 'lend', amount: 2500 },
    ]);
    expect(splitTransfers({ paid: [{ name: '', amount: 3000 }, { name: 'Aina', amount: 6000 }], parts: [{ name: 'Aina', amount: 4500 }], mine: 4500 })).toEqual([
      { from: 'Aina', to: '', type: 'lend', amount: 1500 },
    ]);
  });

  test('entries between others do not count in a book summary\'s totals with me, but do in its net', () => {
    const project: OwedProject = { id: 1, uid: 'p', name: 'Trip', startDate: null, endDate: null, members: [], owner: '' };
    const [s] = projectSummaries([project], [between('Ben', 'lent', 900, 'Aina'), between('Aina', 'lent', 500, '')]);
    expect(s.owedToMe).toBe(500);
    expect(s.settlements).toEqual([
      { from: 'Ben', to: '', type: 'payback', amount: 500 },
      { from: 'Ben', to: 'Aina', type: 'payback', amount: 400 },
    ]);
    expect(s.everyone.sort()).toEqual(['Aina', 'Ben']);
  });
});
