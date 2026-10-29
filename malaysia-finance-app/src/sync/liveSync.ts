import { CloudAuthError } from './cloudApi';

/** Owns one foreground hint connection. Reconnecting always reconciles missed events. */
export function startLiveSync(
  api: { liveUrl: (signal?: AbortSignal) => Promise<string> },
  onChange: () => void,
  onAuthError: () => void,
): () => void {
  let stopped = false;
  let generation = 0;
  let failures = 0;
  let socket: WebSocket | null = null;
  let controller: AbortController | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let handshake: ReturnType<typeof setTimeout> | undefined;
  let changed: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let pong: ReturnType<typeof setTimeout> | undefined;
  let stable: ReturnType<typeof setTimeout> | undefined;

  function clearConnection() {
    controller?.abort();
    controller = null;
    clearTimeout(handshake);
    clearTimeout(changed);
    clearTimeout(pong);
    clearTimeout(stable);
    clearInterval(heartbeat);
    handshake = changed = pong = heartbeat = stable = undefined;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try { socket.close(); } catch { /* Already closed or not yet open. */ }
      socket = null;
    }
  }
  function stop() {
    stopped = true;
    generation++;
    clearTimeout(retry);
    clearConnection();
  }
  function authFailed() { stop(); onAuthError(); }
  function fail(epoch: number) {
    if (stopped || generation !== epoch) return;
    generation++;
    clearConnection();
    // Jitter spreads reconnects after an outage; even fast failures have a backoff.
    const delay = Math.min(60_000, 1000 * 2 ** Math.min(failures++, 6)) * (0.75 + Math.random() * 0.25);
    retry = setTimeout(() => void connect(), delay);
  }
  async function connect() {
    if (stopped) return;
    const epoch = ++generation;
    controller = new AbortController();
    handshake = setTimeout(() => fail(epoch), 15_000);
    try {
      const url = await api.liveUrl(controller.signal);
      if (stopped || epoch !== generation) return;
      const ws = socket = new WebSocket(url);
      ws.onopen = () => {
        if (stopped || epoch !== generation) return;
        heartbeat = setInterval(() => {
          if (ws.readyState !== 1) { fail(epoch); return; }
          try {
            ws.send('ping');
            pong = setTimeout(() => fail(epoch), 10_000);
          } catch { fail(epoch); }
        }, 30_000);
      };
      ws.onmessage = event => {
        if (stopped || epoch !== generation || typeof event.data !== 'string') return;
        if (event.data === 'pong') { clearTimeout(pong); pong = undefined; return; }
        if (event.data.length > 200) return;
        try {
          const message: unknown = JSON.parse(event.data);
          if (!message || typeof message !== 'object' || !('type' in message)) return;
          if (message.type !== 'ready' && message.type !== 'changed') return;
          if (message.type === 'ready') {
            clearTimeout(handshake);
            handshake = undefined;
            // A successful handshake alone is not a healthy connection: a flapping link
            // must retain its backoff instead of requesting a ticket every second.
            if (stable === undefined) stable = setTimeout(() => { failures = 0; }, 60_000);
          }
          // A fixed coalescing window cannot be postponed indefinitely by a stream of events.
          if (changed === undefined) changed = setTimeout(() => {
            changed = undefined;
            if (!stopped && epoch === generation) onChange();
          }, 300);
        } catch { /* Hints cannot inject account data or break HTTP fallback. */ }
      };
      ws.onerror = () => fail(epoch);
      ws.onclose = event => {
        if (stopped || epoch !== generation) return;
        if (event.code === 4001) authFailed();
        else fail(epoch);
      };
    } catch (error) {
      if (stopped || epoch !== generation) return;
      if (error instanceof CloudAuthError) authFailed();
      else fail(epoch);
    }
  }
  void connect();
  return stop;
}
