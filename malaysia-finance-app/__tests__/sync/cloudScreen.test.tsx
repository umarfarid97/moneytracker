import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import Backup from '@/app/backup';
import Cloud from '@/app/cloud';
import { SyncProvider } from '@/sync/SyncProvider';
import { freshDb, renderWithData } from '../screens/helpers';

jest.mock('@/sync/cloudConfig', () => ({ CLOUD_API_URL: 'https://cloud.test' }));
jest.mock('@/sync/random', () => ({ randomBytes: (n: number) => new Uint8Array(require('node:crypto').randomBytes(n)) }));
jest.mock('@/sync/googleAuth', () => ({
  googleAuth: {
    available: true,
    signIn: jest.fn(async () => ({ email: 'umar@gmail.com' })),
    getToken: jest.fn(async () => 'drive-token'),
    refreshToken: jest.fn(async () => null),
    signOut: jest.fn(async () => {}),
  },
}));
jest.mock('@/sync/driveSync', () => ({
  ...jest.requireActual('@/sync/driveSync'),
  syncWithDrive: jest.fn(async () => ({ changedLocal: false })),
}));
jest.mock('@/sync/backupFile', () => ({ saveBackupFile: jest.fn(), pickBackupFile: jest.fn() }));
jest.mock('@/sync/receiptFiles', () => ({
  RECEIPT_FILES: false,
  isStoredReceipt: () => false,
}));
// The OS keystore, in memory.
const mockStore: { session: unknown } = { session: null };
jest.mock('@/sync/cloudSession', () => ({
  loadCloudSession: jest.fn(async () => mockStore.session),
  saveCloudSession: jest.fn(async (s: unknown) => void (mockStore.session = s)),
  clearCloudSession: jest.fn(async () => void (mockStore.session = null)),
}));
jest.mock('@/ui/confirm', () => ({ confirmDelete: jest.fn(async () => true) }));

const { syncWithDrive } = jest.requireMock('@/sync/driveSync');

/** The server, reduced to what the screens call. */
function fakeServer() {
  let bundle: unknown = null;
  let version = 0;
  const state = { code: '654321', deviceName: '' };
  const requests: string[] = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const method = init.method ?? 'GET';
    requests.push(`${method} ${path}`);
    if (path === '/auth/start') return new Response(null, { status: 204 });
    if (path === '/auth/verify') {
      const body = JSON.parse(String(init.body));
      state.deviceName = body.deviceName;
      if (body.code !== state.code) return Response.json({ error: 'code' }, { status: 401 });
      return Response.json({ token: 't'.repeat(40), deviceId: 'dev1', accountId: 'acc', bundle });
    }
    if (path === '/keys' && method === 'GET') return Response.json({ bundle });
    if (path === '/keys' && method === 'PUT') {
      bundle = JSON.parse(String(init.body));
      return new Response(null, { status: 204 });
    }
    if (path === '/sync' && method === 'HEAD') return new Response(null, { headers: { 'X-Sync-Version': String(version) } });
    if (path === '/sync' && method === 'GET') return version === 0 ? new Response(null, { status: 204 }) : new Response(new Uint8Array(1));
    if (path === '/sync' && method === 'PUT') return Response.json({ version: ++version });
    if (path === '/devices') return Response.json({ current: 'dev1', devices: [{ id: 'dev1', name: 'Test phone', createdAt: 1, lastSeen: 1 }] });
    if (path === '/auth/logout' || path === '/account') return new Response(null, { status: 204 });
    throw new Error(`unexpected ${method} ${path}`);
  }) as unknown as typeof fetch;
  return { state, requests, get bundle() { return bundle; } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.session = null;
});

const open = async (db: Awaited<ReturnType<typeof freshDb>>, ui = <Cloud />) => {
  await renderWithData(db, <SyncProvider>{ui}</SyncProvider>);
  await waitFor(() => expect(screen.getAllByText('Duit cloud').length).toBeGreaterThan(0));
};

test('Backup & sync opens Duit cloud setup', async () => {
  fakeServer();
  await open(await freshDb(), <Backup />);
  await fireEvent.press(await screen.findByText('Set up'));
  expect(router.push).toHaveBeenCalledWith('/cloud');
});

test('first device: email code, passphrase, recovery key, then it syncs', async () => {
  const server = fakeServer();
  const db = await freshDb();
  await open(db);

  await fireEvent.changeText(screen.getByLabelText('Email'), 'Umar@Example.com');
  await fireEvent.press(screen.getByText('Send code'));
  await waitFor(() => expect(screen.getByText(/We sent a 6 digit code to umar@example.com/)).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
  await fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen.getByText(/wrong or has expired/)).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Code'), '654321');
  await fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen.getByText('Choose a passphrase')).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Passphrase'), 'short');
  await fireEvent.changeText(screen.getByLabelText('Type it again'), 'short');
  await fireEvent.press(screen.getByText('Create'));
  expect(screen.getByText('Use at least 8 characters.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Passphrase'), 'my long passphrase');
  await fireEvent.changeText(screen.getByLabelText('Type it again'), 'a different one');
  await fireEvent.press(screen.getByText('Create'));
  expect(screen.getByText('The two passphrases do not match.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('Type it again'), 'my long passphrase');
  await fireEvent.press(screen.getByText('Create'));
  await waitFor(() => expect(screen.getByText('Save your recovery key')).toBeTruthy());
  expect(screen.getByLabelText('Recovery key').props.children).toMatch(/^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
  // Nothing is uploaded until the key has been saved.
  expect(server.requests).not.toContain('PUT /sync');

  await fireEvent.press(screen.getByText('I have saved it'));
  await waitFor(() => expect(screen.getByText('Signed in as umar@example.com')).toBeTruthy());
  await waitFor(() => expect(server.requests).toContain('PUT /sync'));
  await waitFor(() => expect(screen.getByText('Last synced just now')).toBeTruthy());
  expect(await db.get('SELECT value FROM sync_state WHERE key = ?', ['cloud.lastSync'])).toBeTruthy();
  // The server holds a wrapped key, never the passphrase.
  expect(JSON.stringify(server.bundle)).not.toContain('my long passphrase');
  expect(await screen.findByText('Test phone')).toBeTruthy();
});

test('second device unlocks with the recovery key after a wrong passphrase', async () => {
  const server = fakeServer();
  // The first device already set things up.
  const { createKeyBundle, newDataKey } = jest.requireActual('@/sync/cryptoBox');
  const { bundle, recoveryKey } = createKeyBundle('first device pass', newDataKey(), { N: 1024 });
  await fakeBundle(server, bundle);

  await open(await freshDb());
  await fireEvent.changeText(screen.getByLabelText('Email'), 'umar@example.com');
  await fireEvent.press(screen.getByText('Send code'));
  await waitFor(() => screen.getByLabelText('Code'));
  await fireEvent.changeText(screen.getByLabelText('Code'), '654321');
  await fireEvent.press(screen.getByText('Continue'));
  await waitFor(() => expect(screen.getByText('Enter your passphrase')).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Passphrase'), 'wrong guess');
  await fireEvent.press(screen.getByText('Unlock'));
  await waitFor(() => expect(screen.getByText(/does not unlock your data/)).toBeTruthy());

  await fireEvent.press(screen.getByText('Use recovery key instead'));
  await fireEvent.changeText(screen.getByLabelText('Recovery key'), recoveryKey);
  await fireEvent.press(screen.getByText('Unlock'));
  await waitFor(() => expect(screen.getByText('Signed in as umar@example.com')).toBeTruthy());
});

/** Puts a ready-made key bundle on the fake server. */
async function fakeBundle(server: ReturnType<typeof fakeServer>, bundle: unknown) {
  await fetch('https://cloud.test/keys', { method: 'PUT', body: JSON.stringify(bundle) });
  expect(server.bundle).toEqual(bundle);
}

test('shows the saved sign-in on the next launch and signs out', async () => {
  fakeServer();
  const { newDataKey, dataKeyToText } = jest.requireActual('@/sync/cryptoBox');
  mockStore.session = { token: 't'.repeat(40), email: 'umar@example.com', deviceId: 'dev1', dataKey: dataKeyToText(newDataKey()) };
  await open(await freshDb());
  await waitFor(() => expect(screen.getByText('Signed in as umar@example.com')).toBeTruthy());

  await fireEvent.press(screen.getByText('Sign out'));
  await waitFor(() => expect(screen.getByText('Send code')).toBeTruthy());
  expect(mockStore.session).toBeNull();
});

test('imports from Google Drive once for people who had connected it', async () => {
  fakeServer();
  const db = await freshDb();
  await db.run(`INSERT INTO sync_state (key, value) VALUES ('drive.email', 'umar@gmail.com')`);
  await open(db);
  await fireEvent.press(await screen.findByText('Import from Drive'));
  await waitFor(() => expect(screen.getByText('Imported from Google Drive.')).toBeTruthy());
  expect(syncWithDrive).toHaveBeenCalledWith(db, 'drive-token');
  expect(await db.get('SELECT value FROM sync_state WHERE key = ?', ['drive.email'])).toBeNull();
  expect(screen.queryByText('Import from Drive')).toBeNull();
});

test('does not offer the Drive import to people who never connected Drive', async () => {
  fakeServer();
  await open(await freshDb());
  expect(screen.queryByText('Import from Drive')).toBeNull();
});
