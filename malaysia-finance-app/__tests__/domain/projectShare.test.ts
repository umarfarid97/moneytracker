import type { OwedEntry, OwedProject } from '@/domain/owed';
import { buildShare, importAs, parseShare, settlementLines, whoCanIBe } from '@/domain/projectShare';

const project: OwedProject = { id: 2, uid: 'p2', name: 'Penang trip', startDate: '2026-10-10', endDate: '2026-10-12', members: ['Aina', 'Ben'], owner: '' };
let id = 0;
const entry = (person: string, kind: OwedEntry['kind'], amount: number, projectId = 2): OwedEntry => ({
  id: ++id, person, kind, amount, date: '2026-10-11', note: '', projectId,
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

  test('importing as Aina flips the sender\'s entries to her point of view and drops other people\'s', () => {
    const payload = parseShare(buildShare(project, entries, 'Umar'))!;
    const { project: p, entries: mine } = importAs(payload, 'Aina');
    expect(p).toMatchObject({ name: 'Penang trip', owner: 'Umar', startDate: '2026-10-10' });
    expect(p.members).toEqual(['Umar', 'Ben']);
    expect(mine.map((e) => [e.person, e.kind, e.amount])).toEqual([['Umar', 'borrowed', 5000], ['Umar', 'paidBack', 1000]]);
  });
});
