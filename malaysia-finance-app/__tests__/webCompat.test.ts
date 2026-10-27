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
  const fakeDoc = (rootText: string) => {
    const made: any[] = [];
    const el = (): any => ({
      children: [] as any[], textContent: '', id: '',
      setAttribute() {}, append(...c: any[]) { this.children.push(...c); },
    });
    const root = { innerText: rootText };
    const body = el();
    return {
      made, body,
      getElementById: (id: string) => (id === 'root' ? root : made.find((m) => m.id === id) ?? null),
      createElement: () => { const e = el(); made.push(e); return e; },
    };
  };
  const fakeWin = (storage: Record<string, string> | null = {}) => {
    const listeners: Record<string, (e: any) => void> = {};
    return {
      listeners, reload: jest.fn(),
      navigator: { userAgent: 'TestUA' },
      setTimeout: jest.fn(),
      addEventListener: (n: string, f: any) => { listeners[n] = f; },
      sessionStorage: storage && {
        getItem: (k: string) => storage[k] ?? null,
        setItem: (k: string, v: string) => { storage[k] = v; },
        removeItem: (k: string) => { delete storage[k]; },
      },
      get location() { return { reload: this.reload }; },
    };
  };

  it('reloads once when nothing is shown, then shows the first error', () => {
    const store: Record<string, string> = {};
    const win = fakeWin(store); const doc = fakeDoc('');
    const check = installStartupFallback(win, doc);
    win.listeners.error({ error: new Error('boom') });
    check();
    expect(win.reload).toHaveBeenCalledTimes(1);
    expect(doc.made).toHaveLength(0);

    check(); // still blank after the reload
    expect(win.reload).toHaveBeenCalledTimes(1);
    const texts = doc.made.map((m) => m.textContent);
    expect(texts).toContain('Duit could not start');
    expect(texts.some((t) => t.includes('boom') && t.includes('TestUA'))).toBe(true);
  });

  it('never reloads when it cannot remember having reloaded', () => {
    const win = fakeWin(null); const doc = fakeDoc('   ');
    installStartupFallback(win, doc)();
    expect(win.reload).not.toHaveBeenCalled();
    expect(doc.made.map((m) => m.textContent)).toContain('Duit could not start');
  });

  it('does nothing once the app shows text, and clears the reload flag', () => {
    const store = { 'duit.startupReload': '1' };
    const win = fakeWin(store); const doc = fakeDoc('Tue 27 Oct');
    installStartupFallback(win, doc)();
    expect(win.reload).not.toHaveBeenCalled();
    expect(doc.body.children).toHaveLength(0);
    expect(store).toEqual({});
  });
});
