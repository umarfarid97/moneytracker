import { CloudApi, CloudAuthError } from '@/sync/cloudApi';
import { startLiveSync } from '@/sync/liveSync';

class Socket {
  static instances: Socket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  send = jest.fn();
  close = jest.fn();
  constructor(readonly url: string) { Socket.instances.push(this); }
  message(data: string) { this.onmessage?.({ data }); }
}
const original = global.WebSocket;
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
let stops: (() => void)[];
beforeEach(() => {
  jest.useFakeTimers();
  Socket.instances = [];
  global.WebSocket = Socket as unknown as typeof WebSocket;
  stops = [];
});
afterEach(() => { stops.forEach(stop => stop()); global.WebSocket = original; jest.restoreAllMocks(); jest.useRealTimers(); });
function start(api = { liveUrl: jest.fn<Promise<string>, [signal?: AbortSignal]>(async () => 'wss://cloud.test/events?ticket=short') }) {
  const change = jest.fn();
  const auth = jest.fn();
  const stop = startLiveSync(api, change, auth);
  stops.push(stop);
  return { api, change, auth, stop };
}

test('ready catches up missed updates and bursts of hints coalesce without accepting data payloads', async () => {
  const { change } = start();
  await flush();
  const socket = Socket.instances[0];
  socket.onopen?.();
  socket.message('{"type":"ready"}');
  socket.message('{"type":"changed"}');
  socket.message('{"type":"changed"}');
  jest.advanceTimersByTime(300);
  expect(change).toHaveBeenCalledTimes(1);
  socket.message('not JSON');
  socket.message('{"type":"expense","amount":999}');
  jest.advanceTimersByTime(300);
  expect(change).toHaveBeenCalledTimes(1);
});

test('error and close schedule only one backoff retry; reconnect ready catches up', async () => {
  const { api, change } = start();
  await flush();
  const first = Socket.instances[0];
  first.onopen?.();
  const lateClose = first.onclose;
  first.onerror?.();
  lateClose?.({ code: 1006 });
  expect(api.liveUrl).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(2000);
  await flush();
  expect(api.liveUrl).toHaveBeenCalledTimes(2);
  Socket.instances[1].message('{"type":"ready"}');
  jest.advanceTimersByTime(300);
  expect(change).toHaveBeenCalledTimes(1);
});

test('stopping ignores an outstanding ticket and clears queued callbacks and timers', async () => {
  let resolve!: (url: string) => void;
  const api = { liveUrl: jest.fn(() => new Promise<string>(r => { resolve = r; })) };
  const { stop, change } = start(api);
  stop();
  resolve('wss://cloud.test/events?ticket=stale');
  await flush();
  jest.advanceTimersByTime(120_000);
  expect(Socket.instances).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('stop closes a connected socket and cancels delayed change notifications', async () => {
  const { stop, change } = start();
  await flush();
  const socket = Socket.instances[0];
  socket.onopen?.();
  socket.message('{"type":"ready"}');
  stop();
  jest.advanceTimersByTime(120_000);
  expect(socket.close).toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('heartbeats tolerate pong and reconnect a dead socket', async () => {
  const { api } = start();
  await flush();
  const socket = Socket.instances[0];
  socket.onopen?.();
  socket.message('{"type":"ready"}');
  jest.advanceTimersByTime(30_000);
  expect(socket.send).toHaveBeenCalledWith('ping');
  socket.message('pong');
  jest.advanceTimersByTime(10_000);
  expect(socket.close).not.toHaveBeenCalled();
  jest.advanceTimersByTime(30_000);
  expect(socket.close).toHaveBeenCalled();
  jest.advanceTimersByTime(2000);
  await flush();
  expect(api.liveUrl).toHaveBeenCalledTimes(2);
});

test('a hung ticket is aborted and retried, and late completion cannot create a stale socket', async () => {
  let resolve!: (url: string) => void;
  let signal: AbortSignal | undefined;
  const api = { liveUrl: jest.fn((nextSignal?: AbortSignal) => {
    signal = nextSignal;
    return new Promise<string>(r => { resolve = r; });
  }) };
  start(api);
  const firstResolve = resolve;
  jest.advanceTimersByTime(15_000);
  expect(signal?.aborted).toBe(true);
  jest.advanceTimersByTime(2000);
  expect(api.liveUrl).toHaveBeenCalledTimes(2);
  firstResolve('wss://cloud.test/events?ticket=late');
  await flush();
  expect(Socket.instances).toHaveLength(0);
});

test('repeated endpoint failures back off to a capped retry interval', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(1);
  const api = { liveUrl: jest.fn(async () => { throw new Error('old server or offline'); }) };
  start(api);
  await flush();
  for (const delay of [1000, 2000, 4000, 8000, 16_000, 32_000]) await jest.advanceTimersByTimeAsync(delay);
  const calls = api.liveUrl.mock.calls.length;
  await jest.advanceTimersByTimeAsync(59_999);
  expect(api.liveUrl).toHaveBeenCalledTimes(calls);
  await jest.advanceTimersByTimeAsync(1);
  expect(api.liveUrl).toHaveBeenCalledTimes(calls + 1);
});

test('short-lived ready connections retain backoff until a connection is stable for a minute', async () => {
  jest.spyOn(Math, 'random').mockReturnValue(1);
  const { api } = start();
  await flush();
  for (let i = 0; i < 3; i++) {
    const socket = Socket.instances[i];
    socket.onopen?.();
    socket.message('{"type":"ready"}');
    jest.advanceTimersByTime(300);
    socket.onclose?.({ code: 1006 });
    jest.advanceTimersByTime(1000 * 2 ** i - 1);
    await flush();
    expect(api.liveUrl).toHaveBeenCalledTimes(i + 1);
    jest.advanceTimersByTime(1);
    await flush();
    expect(api.liveUrl).toHaveBeenCalledTimes(i + 2);
  }
  const stable = Socket.instances[3];
  stable.onopen?.(); stable.message('{"type":"ready"}');
  jest.advanceTimersByTime(30_000); stable.message('pong');
  jest.advanceTimersByTime(30_000); stable.message('pong');
  stable.onclose?.({ code: 1006 });
  jest.advanceTimersByTime(999); await flush();
  expect(api.liveUrl).toHaveBeenCalledTimes(4);
  jest.advanceTimersByTime(1); await flush();
  expect(api.liveUrl).toHaveBeenCalledTimes(5);
});

test('revoked sessions stop retrying and surface sign-in errors', async () => {
  const failed = start({ liveUrl: jest.fn(async () => { throw new CloudAuthError(); }) });
  await flush();
  expect(failed.auth).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(120_000);
  expect(failed.api.liveUrl).toHaveBeenCalledTimes(1);
  const live = start();
  await flush();
  Socket.instances[0].onclose?.({ code: 4001 });
  expect(live.auth).toHaveBeenCalledTimes(1);
});

test('CloudApi exchanges bearer auth for a short-lived ticket without placing bearer in a URL', async () => {
  global.fetch = jest.fn(async () => Response.json({ ticket: 'a'.repeat(24) + '.' + 'b'.repeat(24) + '.' + 'c'.repeat(43) }));
  const api = new CloudApi('https://cloud.test', 'private-bearer');
  const url = await api.liveUrl();
  expect(url).toMatch(/^wss:\/\/cloud.test\/events\?ticket=/);
  expect(url).not.toContain('private-bearer');
  expect(fetch).toHaveBeenCalledWith('https://cloud.test/events/ticket', expect.objectContaining({ method: 'POST', headers: { Authorization: 'Bearer private-bearer' } }));
});
