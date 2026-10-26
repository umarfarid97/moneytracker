/** The few Google Drive calls sync needs, all inside the app's hidden folder (appDataFolder). */
const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

export type DriveFile = { id: string; name: string };

/** Google rejected the token (expired or access removed). */
export class DriveAuthError extends Error {
  constructor() {
    super('Google Drive sign-in expired');
  }
}

export async function driveFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) {
    // 403 is also used for rate limits; only treat it as sign-in trouble when Google says so.
    const text = res.status === 403 ? await res.text() : '';
    if (res.status === 401 || /insufficient|forbidden|permission/i.test(text)) throw new DriveAuthError();
    throw new Error(`Google Drive error ${res.status}`);
  }
  if (!res.ok) throw new Error(`Google Drive error ${res.status}`);
  return res;
}

export async function listFiles(token: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ spaces: 'appDataFolder', pageSize: '1000', fields: 'nextPageToken,files(id,name)' });
    if (pageToken) params.set('pageToken', pageToken);
    const body = (await (await driveFetch(token, `${FILES}?${params}`)).json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(body.files ?? []));
    pageToken = body.nextPageToken;
  } while (pageToken);
  return files;
}

export async function readText(token: string, id: string): Promise<string> {
  return (await driveFetch(token, downloadUrl(id))).text();
}

/** Writes a JSON file, replacing the one with `id` if given. Returns the file's id. */
export async function writeJson(token: string, name: string, text: string, id?: string): Promise<string> {
  if (id) {
    await driveFetch(token, mediaUrl(id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text });
    return id;
  }
  const boundary = `duit${Date.now()}`;
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name, parents: ['appDataFolder'] }),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    text,
    `--${boundary}--`,
  ].join('\r\n');
  const res = await driveFetch(token, `${UPLOAD}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return ((await res.json()) as { id: string }).id;
}

/** Creates an empty file to upload content into (see mediaUrl). Returns its id. */
export async function createFile(token: string, name: string, mimeType: string): Promise<string> {
  const res = await driveFetch(token, `${FILES}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType, parents: ['appDataFolder'] }),
  });
  return ((await res.json()) as { id: string }).id;
}

export const mediaUrl = (id: string) => `${UPLOAD}/${id}?uploadType=media`;
export const downloadUrl = (id: string) => `${FILES}/${id}?alt=media`;
