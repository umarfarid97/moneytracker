import { AccountCoordinator, type Env } from '../src/index';
import worker from '../src/index';
export class TestCoordinator extends AccountCoordinator {
  constructor(ctx: DurableObjectState, env: Env) { super(ctx, wrap(env)); }
  async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname.endsWith('/__expireLiveTickets')) {
      const tickets = await this.ctx.storage.get<{ deviceId: string; hash: string; expires: number }[]>('liveTickets') ?? [];
      await this.ctx.storage.put('liveTickets', tickets.map(ticket => ({ ...ticket, expires: 0 })));
      return new Response('ok');
    }
    if (new URL(req.url).pathname.endsWith('/__alarm')) { await this.alarm(); return new Response('ok'); }
    if (new URL(req.url).pathname.endsWith('/__state')) return Response.json({
      journal: await this.ctx.storage.get('journal'), fence: await this.ctx.storage.get('fence'), alarm: await this.ctx.storage.getAlarm(), boundAccount: await this.ctx.storage.get('account'),
    });
    return super.fetch(req);
  }
}
export function wrap(env: any) {
  return { ...env, SEND_MAIL: async (_to: string, code: string) => { await env.TEST_IO.fetch('https://io.test/mail?code=' + code); }, RECEIPTS: new Proxy(env.RECEIPTS, { get(target, key) {
    if (key === 'put' || key === 'delete') return async (...args: any[]) => {
      const response = await env.TEST_IO.fetch('https://io.test/' + String(key), { method: 'POST' });
      if (!response.ok) throw new Error('Injected local storage failure');
      return target[key](...args);
    };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  }}) };
}
export default { fetch(req: Request, env: any) {
  const path = new URL(req.url).pathname;
  if (path.startsWith('/__test/')) {
    const accountId = path.split('/')[2];
    return env.ACCOUNTS.get(env.ACCOUNTS.idFromName(accountId)).fetch(req);
  }
  return worker.fetch(req, wrap(env));
} };

