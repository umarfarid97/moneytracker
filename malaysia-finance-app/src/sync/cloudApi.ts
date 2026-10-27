import type { KeyBundle } from './cryptoBox';

/** The server rejected this device's token (signed out from another device, or the account was deleted). */
export class CloudAuthError extends Error {
  constructor() {
    super('Duit cloud sign-in expired');
  }
}
/** Someone else uploaded first; fetch, merge and try again. */
export class CloudConflictError extends Error {
  constructor(readonly version: number) {
    super('Cloud copy changed');
  }
}
/** A wrong or expired sign-in code. */
export class CloudCodeError extends Error {
  constructor() {
    super('Wrong or expired code');
  }
}
/** Too many tries; wait before asking again. */
export class CloudRateError extends Error {
  constructor() {
    super('Too many tries');
  }
}
export class CloudError extends Error {
  constructor(readonly status: number) {
    super(`Duit cloud error ${status}`);
  }
}

export type CloudDevice = { id: string; name: string; createdAt: number; lastSeen: number };
export type Login = { token: string; deviceId: string; accountId: string; bundle: unknown };
export type Remote = { version: number; schema: number; bytes: Uint8Array };

export class CloudApi {
  constructor(private base: string, private token: string | null = null) {}

  private async call(method: string, path: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}): Promise<Response> {
    const headers: Record<string, string> = { ...init.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${this.base}${path}`, { method, headers, body: init.body });
    if (res.status === 401 && this.token) throw new CloudAuthError();
    if (res.status === 429) throw new CloudRateError();
    return res;
  }

  private async ok(res: Response): Promise<Response> {
    if (!res.ok) throw new CloudError(res.status);
    return res;
  }

  async start(email: string): Promise<void> {
    await this.ok(await this.call('POST', '/auth/start', { body: JSON.stringify({ email }) }));
  }

  async verify(email: string, code: string, deviceName: string): Promise<Login> {
    const res = await this.call('POST', '/auth/verify', { body: JSON.stringify({ email, code, deviceName }) });
    if (res.status === 401 || res.status === 400) throw new CloudCodeError();
    return (await this.ok(res)).json() as Promise<Login>;
  }

  async logout(): Promise<void> {
    await this.call('POST', '/auth/logout');
  }

  async getKeys(): Promise<unknown> {
    return ((await (await this.ok(await this.call('GET', '/keys'))).json()) as { bundle: unknown }).bundle;
  }

  async putKeys(bundle: KeyBundle): Promise<void> {
    await this.ok(await this.call('PUT', '/keys', { body: JSON.stringify(bundle) }));
  }

  /** The cloud copy's version without downloading it (0 when empty). */
  async version(): Promise<number> {
    const res = await this.ok(await this.call('HEAD', '/sync'));
    return Number(res.headers.get('X-Sync-Version') ?? 0);
  }

  async getSnapshot(): Promise<Remote | null> {
    const res = await this.ok(await this.call('GET', '/sync'));
    if (res.status === 204) return null;
    return {
      version: Number(res.headers.get('X-Sync-Version')),
      schema: Number(res.headers.get('X-Sync-Schema') ?? 0),
      bytes: new Uint8Array(await res.arrayBuffer()),
    };
  }

  /** Uploads on top of `version`; throws CloudConflictError when the cloud copy has moved on. */
  async putSnapshot(version: number, schema: number, bytes: Uint8Array): Promise<number> {
    const res = await this.call('PUT', '/sync', {
      body: bytes as unknown as BodyInit,
      headers: { 'Content-Type': 'application/octet-stream', 'If-Match': String(version), 'X-Sync-Schema': String(schema) },
    });
    if (res.status === 409) throw new CloudConflictError(((await res.json()) as { version: number }).version);
    return ((await (await this.ok(res)).json()) as { version: number }).version;
  }

  async listReceipts(): Promise<string[]> {
    const body = (await (await this.ok(await this.call('GET', '/receipts'))).json()) as { receipts: { name: string }[] };
    return body.receipts.map((r) => r.name);
  }

  async getReceipt(name: string): Promise<Uint8Array> {
    return new Uint8Array(await (await this.ok(await this.call('GET', `/receipts/${encodeURIComponent(name)}`))).arrayBuffer());
  }

  async putReceipt(name: string, bytes: Uint8Array): Promise<void> {
    await this.ok(
      await this.call('PUT', `/receipts/${encodeURIComponent(name)}`, {
        body: bytes as unknown as BodyInit,
        headers: { 'Content-Type': 'application/octet-stream' },
      }),
    );
  }

  async devices(): Promise<{ current: string; devices: CloudDevice[] }> {
    return (await this.ok(await this.call('GET', '/devices'))).json() as Promise<{ current: string; devices: CloudDevice[] }>;
  }

  async removeDevice(id: string): Promise<void> {
    await this.ok(await this.call('DELETE', `/devices/${id}`));
  }

  async deleteAccount(): Promise<void> {
    await this.ok(await this.call('DELETE', '/account'));
  }
}
