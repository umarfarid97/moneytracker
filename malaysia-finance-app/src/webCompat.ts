/**
 * Browser-only helpers, loaded first by the web build (see polyfills.web.ts).
 *
 * Older iPhones (iOS 15.3 and earlier) run Safari without a few newer built-ins that React Navigation, Reanimated
 * and Expo Router call while starting. One missing function throws before the first render, which leaves a blank
 * page, so the gaps are filled here. The second half shows a message instead of a blank page if startup still fails.
 */

type Scope = Record<string, any>;

/** Fills in built-ins that Safari before 15.4 lacks. Only adds what is missing, so modern browsers are untouched. */
export function installCompat(scope: Scope): void {
  const define = (target: any, name: string, value: unknown) => {
    if (target && typeof target[name] === 'undefined') {
      Object.defineProperty(target, name, { value, writable: true, configurable: true });
    }
  };

  define(Object, 'hasOwn', (obj: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(obj, key));

  define(scope, 'requestIdleCallback', (cb: (d: { didTimeout: boolean; timeRemaining: () => number }) => void) =>
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 1));
  define(scope, 'cancelIdleCallback', (id: number) => clearTimeout(id));

  // Enough for the plain data (objects, arrays, dates, numbers) the animation library clones.
  define(scope, 'structuredClone', (value: unknown) => cloneData(value));

  const arrayProto = Array.prototype as any;
  define(arrayProto, 'at', function (this: unknown[], index: number) {
    const i = Math.trunc(index) || 0;
    return this[i < 0 ? this.length + i : i];
  });
  define(arrayProto, 'findLast', function (this: unknown[], fn: (v: unknown, i: number, a: unknown[]) => unknown) {
    for (let i = this.length - 1; i >= 0; i--) if (fn(this[i], i, this)) return this[i];
    return undefined;
  });
  define(arrayProto, 'findLastIndex', function (this: unknown[], fn: (v: unknown, i: number, a: unknown[]) => unknown) {
    for (let i = this.length - 1; i >= 0; i--) if (fn(this[i], i, this)) return i;
    return -1;
  });
  define(String.prototype, 'at', function (this: string, index: number) {
    const i = Math.trunc(index) || 0;
    return this.charAt(i < 0 ? this.length + i : i) || undefined;
  });

  const c = scope.crypto;
  if (c && typeof c.randomUUID !== 'function' && typeof c.getRandomValues === 'function') {
    define(c, 'randomUUID', () => {
      const b = c.getRandomValues(new Uint8Array(16)) as Uint8Array;
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    });
  }
}

function cloneData(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(cloneData);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) out[key] = cloneData((value as Record<string, unknown>)[key]);
  return out;
}

/**
 * If the app has drawn nothing a few seconds after start, replace the blank page with the error that stopped it, so
 * a failed start can be reported instead of a white screen. Returns a function that runs the check immediately.
 */
export function installStartupFallback(win: Scope, doc: Scope, waitMs = 8000): () => void {
  let firstError = '';
  const remember = (message: unknown) => {
    if (!firstError && message) firstError = String((message as Error)?.message ?? message);
  };
  win.addEventListener('error', (e: any) => remember(e?.error ?? e?.message));
  win.addEventListener('unhandledrejection', (e: any) => remember(e?.reason));

  const check = () => {
    const root = doc.getElementById('root');
    if (!root || root.childElementCount > 0 || doc.getElementById('duit-startup-error')) return;
    const box = doc.createElement('div');
    box.id = 'duit-startup-error';
    box.setAttribute('style',
      'position:fixed;inset:0;display:flex;flex-direction:column;justify-content:center;padding:24px;' +
      'font:16px/1.5 -apple-system,system-ui,sans-serif;background:#fff;color:#111;');
    const title = doc.createElement('h1');
    title.setAttribute('style', 'font-size:20px;margin:0 0 8px');
    title.textContent = 'Duit could not start';
    const body = doc.createElement('p');
    body.setAttribute('style', 'margin:0 0 12px');
    body.textContent = 'Try reloading the page. If it keeps happening, update your browser and send this message to the developer:';
    const detail = doc.createElement('pre');
    detail.setAttribute('style', 'white-space:pre-wrap;word-break:break-word;font-size:13px;background:#f3f4f6;padding:12px;border-radius:8px;margin:0');
    detail.textContent = `${firstError || 'No error was reported (the app did not finish loading).'}\n${win.navigator?.userAgent ?? ''}`;
    box.append(title, body, detail);
    doc.body.append(box);
  };
  win.setTimeout(check, waitMs);
  return check;
}
