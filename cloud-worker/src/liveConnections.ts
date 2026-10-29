import { HttpError, json, type Env } from './index';
import { randomToken, safeEqual, sha256Hex } from './util';

type Ticket = { deviceId: string; hash: string; expires: number };
const TICKET_TTL = 30_000;
const TICKET_PATTERN = /^([0-9a-f]{24,32})\.([0-9a-f]{24,32})\.([A-Za-z0-9_-]{43})$/;

export function liveTicketParts(value: string): RegExpMatchArray {
  const parts = value.match(TICKET_PATTERN);
  if (!parts) throw new HttpError(401, { error: 'auth' });
  return parts;
}

export function requireLiveOrigin(req: Request, env: Env, allowOwnOrigin = false): void {
  const origin = req.headers.get('origin');
  // Android's native WebSocket implementation supplies the target's https origin itself.
  const nativeOrigin = allowOwnOrigin && origin === new URL(req.url).origin;
  if (origin && !nativeOrigin && !env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).includes(origin)) {
    throw new HttpError(403);
  }
}

/** Advisory hints only. Encrypted account data continues to use the authenticated HTTP API. */
export class LiveConnections {
  constructor(private ctx: DurableObjectState, private env: Env) {}

  async issue(accountId: string, deviceId: string): Promise<Response> {
    const now = Date.now();
    const secret = randomToken();
    const tickets = (await this.ctx.storage.get<Ticket[]>('liveTickets') ?? [])
      .filter(t => t.expires > now && t.deviceId !== deviceId);
    // One pending ticket per device; cap storage even under unexpected device churn.
    tickets.push({ deviceId, hash: await sha256Hex(secret), expires: now + TICKET_TTL });
    await this.ctx.storage.put('liveTickets', tickets.slice(-10));
    return json(200, { ticket: `${accountId}.${deviceId}.${secret}` });
  }

  async accept(req: Request, accountId: string): Promise<Response> {
    requireLiveOrigin(req, this.env, true);
    if (req.method !== 'GET' || req.headers.get('upgrade')?.toLowerCase() !== 'websocket') throw new HttpError(426);
    const [, routedAccount, deviceId, secret] = liveTicketParts(new URL(req.url).searchParams.get('ticket') ?? '');
    if (routedAccount !== accountId) throw new HttpError(401);
    const tickets = await this.ctx.storage.get<Ticket[]>('liveTickets') ?? [];
    const ticket = tickets.find(t => t.deviceId === deviceId);
    if (!ticket || ticket.expires <= Date.now() || !safeEqual(ticket.hash, await sha256Hex(secret))) throw new HttpError(401);
    // Single use even if the client disconnects during admission.
    await this.ctx.storage.put('liveTickets', tickets.filter(t => t.deviceId !== deviceId));
    const device = await this.env.DB.prepare('SELECT id FROM devices WHERE id = ? AND account_id = ?')
      .bind(deviceId, accountId).first();
    if (!device) throw new HttpError(401, { error: 'auth' });
    const sockets = this.ctx.getWebSockets();
    if (sockets.length >= 40 || sockets.filter(ws => this.device(ws) === deviceId).length >= 8) throw new HttpError(429);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ deviceId });
    server.send('{"type":"ready"}');
    return new Response(null, { status: 101, webSocket: client });
  }

  private device(ws: WebSocket): string | undefined {
    const attachment: unknown = ws.deserializeAttachment();
    return attachment && typeof attachment === 'object' && 'deviceId' in attachment && typeof attachment.deviceId === 'string'
      ? attachment.deviceId : undefined;
  }

  async refresh(accountId: string, changedBy?: string): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;
    const { results } = await this.env.DB.prepare('SELECT id FROM devices WHERE account_id = ?').bind(accountId).all<{ id: string }>();
    const valid = new Set(results.map(row => row.id));
    for (const ws of sockets) {
      const device = this.device(ws);
      try {
        if (!device || !valid.has(device)) ws.close(4001, 'Sign in again');
        else if (changedBy && device !== changedBy) ws.send('{"type":"changed"}');
      } catch { /* A disconnected socket must not turn a committed write into an error. */ }
    }
  }

  closeAll(): void {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.close(4001, 'Sign in again'); } catch { /* Already disconnected. */ }
    }
  }
}
