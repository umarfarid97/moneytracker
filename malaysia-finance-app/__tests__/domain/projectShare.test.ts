import type { OwedEntry, OwedProject } from '@/domain/owed';
import { buildShare, importAs, parseShare, settlementLines, whoCanIBe } from '@/domain/projectShare';

const project: OwedProject = { id: 2, uid: 'p2', name: 'Penang trip', startDate: '2026-10-10', endDate: '2026-10-12', members: ['Aina', 'Ben'], owner: '' };
let id = 0;
const entry = (person: string, kind: OwedEntry['kind'], amount: number, projectId = 2): OwedEntry => ({
  id: ++id, person, kind, amount, date: '2026-10-11', note: '', projectId, counter: '',
});
const entries = [entry('Aina', 'lent', 5000), entry('Ben', 'lent', 3000), entry('Aina', 'repaid', 1000), entry('Zed', 'lent', 999, 3)];

describe('sharing a project', () => {
  test('the readable part says who pays whom', () => {
    expect(settlementLines('Umar', entries.filter((e) => e.projectId === 2))).toEqual([
      'Aina pays Umar RM 40.00', 'Ben pays Umar RM 30.00',
    ]);
    const text = buildShare(project, entries, 'Umar');
    expect(text).toContain('Penang trip');
    expect(text).toContain('Aina pays Umar RM 40.00');
    expect(text).not.toContain('Zed');
  });

  test('what is shared can be read back, and nothing else parses', () => {
    const payload = parseShare(buildShare(project, entries, 'Umar'));
    expect(payload).toMatchObject({ name: 'Penang trip', owner: 'Umar', members: ['Aina', 'Ben'] });
    expect(payload?.entries).toHaveLength(3);
    expect(parseShare('just a message')).toBeNull();
    const text = buildShare(project, entries, 'Umar');
    expect(parseShare(text.slice(0, text.length - 20))).toBeNull();
  });

  test('you can only be someone other than the sender', () => {
    const payload = parseShare(buildShare({ ...project, members: ['Aina', 'Umar', 'Ben'] }, entries, 'Umar'))!;
    expect(whoCanIBe(payload)).toEqual(['Aina', 'Ben']);
  });

  test('importing as Aina flips the sender\'s entries to her point of view and keeps what is between others', () => {
    const payload = parseShare(buildShare(project, entries, 'Umar'))!;
    const { project: p, entries: mine } = importAs(payload, 'Aina');
    expect(p).toMatchObject({ name: 'Penang trip', owner: 'Umar', startDate: '2026-10-10' });
    expect(p.members).toEqual(['Umar', 'Ben']);
    expect(mine.map((e) => [e.person, e.kind, e.amount, e.counter])).toEqual([
      ['Umar', 'borrowed', 5000, ''], ['Ben', 'lent', 3000, 'Umar'], ['Umar', 'paidBack', 1000, ''],
    ]);
  });

  test('entries between two other people travel with the share, and the summary lists the fewest payments', () => {
    const all = [
      entry('Ben', 'lent', 3000), // Umar paid 30 for Ben
      { ...entry('Aina', 'lent', 2000), counter: 'Ben' }, // Ben paid 20 for Aina
    ];
    const text = buildShare(project, all, 'Umar');
    expect(text).toContain('Ben pays Umar RM 10.00');
    expect(text).toContain('Aina pays Umar RM 20.00');
    expect(text).toContain('Umar: is owed RM 30.00');
    expect(text).toContain('Ben paid for Aina RM 20.00');
    const payload = parseShare(text)!;
    expect(payload.members).toEqual(['Aina', 'Ben']);
    // Ben imports it: Umar paid for me, and I paid for Aina.
    const { entries: bens } = importAs(payload, 'Ben');
    expect(bens.map((e) => [e.person, e.kind, e.amount, e.counter])).toEqual([
      ['Umar', 'borrowed', 3000, ''], ['Aina', 'lent', 2000, ''],
    ]);
  });

  test('older shares without a counter still import', () => {
    const old = parseShare(buildShare(project, [entry('Aina', 'lent', 100)], 'Umar').replace(/,"counter":""/g, ''))!;
    expect(importAs(old, 'Aina').entries[0]).toMatchObject({ person: 'Umar', kind: 'borrowed', counter: '' });
  });
});
