import { installCompat, installStartupFallback } from '../src/webCompat';

describe('installCompat', () => {
  it('adds the built-ins old Safari lacks, and leaves existing ones alone', () => {
    const saved = { hasOwn: Object.hasOwn, at: (Array.prototype as any).at, findLast: (Array.prototype as any).findLast };
    delete (Object as any).hasOwn;
    delete (Array.prototype as any).at;
    delete (Array.prototype as any).findLast;
    try {
      const scope: Record<string, any> = { crypto: { getRandomValues: (a: Uint8Array) => a.fill(7) } };
      installCompat(scope);
      expect(Object.hasOwn({ a: 1 }, 'a')).toBe(true);
      expect(Object.hasOwn({}, 'toString')).toBe(false);
      expect([1, 2, 3].at(-1)).toBe(3);
      expect([1, 2, 3, 4].findLast((n) => n % 2 === 1)).toBe(3);
      expect(typeof scope.requestIdleCallback).toBe('function');
      expect(scope.structuredClone({ a: [1, { b: 2 }] })).toEqual({ a: [1, { b: 2 }] });
      expect(scope.crypto.randomUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

      const keep = () => 'mine';
      const other: Record<string, any> = { requestIdleCallback: keep };
      installCompat(other);
      expect(other.requestIdleCallback).toBe(keep);
    } finally {
      (Object as any).hasOwn = saved.hasOwn;
      (Array.prototype as any).at = saved.at;
      (Array.prototype as any).findLast = saved.findLast;
    }
  });
});

describe('installStartupFallback', () => {
  const fakeDoc = (rootChildren: number) => {
    const made: any[] = [];
    const el = (): any => ({
      attrs: {}, children: [] as any[], textContent: '',
      setAttribute() {}, append(...c: any[]) { this.children.push(...c); },
    });
    const root = { childElementCount: rootChildren };
    const body = el();
    return {
      made, body,
      getElementById: (id: string) => (id === 'root' ? root : made.find((m) => m.id === id) ?? null),
      createElement: () => { const e = el(); made.push(e); return e; },
    };
  };
  const fakeWin = () => {
    const listeners: Record<string, (e: any) => void> = {};
    return { listeners, navigator: { userAgent: 'TestUA' }, setTimeout: jest.fn(), addEventListener: (n: string, f: any) => { listeners[n] = f; } };
  };

  it('shows the first error when nothing was drawn', () => {
    const win = fakeWin(); const doc = fakeDoc(0);
    const check = installStartupFallback(win, doc);
    win.listeners.error({ error: new Error('boom') });
    check();
    const texts = doc.made.map((m) => m.textContent);
    expect(texts).toContain('Duit could not start');
    expect(texts.some((t) => t.includes('boom') && t.includes('TestUA'))).toBe(true);
  });

  it('does nothing once the app has rendered', () => {
    const doc = fakeDoc(1);
    installStartupFallback(fakeWin(), doc)();
    expect(doc.body.children).toHaveLength(0);
  });
});
