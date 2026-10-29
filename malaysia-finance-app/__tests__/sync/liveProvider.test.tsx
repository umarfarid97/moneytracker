import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import type { ReactNode } from 'react';
import { SyncProvider, useSync } from '@/sync/SyncProvider';
import { startLiveSync } from '@/sync/liveSync';
import { syncWithCloud } from '@/sync/cloudSync';

const mockData = { db: { all: jest.fn(async () => []), run: jest.fn(async () => {}) }, reload: jest.fn(async () => {}), expenses: [] as unknown[], categories: [], commitments: [], reliefClaims: [], budgets: [], profile: {}, paymentMethods: [], retirementEntries: [], givingRecords: [], savingsAccounts: [] };
jest.mock('@/hooks/DataProvider', () => ({ useData: () => mockData }));
jest.mock('@/sync/cloudConfig', () => ({ CLOUD_API_URL: 'https://cloud.test' }));
jest.mock('@/sync/cloudSession', () => ({
  loadCloudSession: jest.fn(async () => ({ token: 'private-token', email: 'local@example.test', deviceId: 'device', dataKey: 'dummy' })),
  saveCloudSession: jest.fn(), clearCloudSession: jest.fn(),
}));
jest.mock('@/sync/cloudAccount', () => ({ dataKeyBytes: () => new Uint8Array(32) }));
jest.mock('@/sync/cloudSync', () => ({ syncWithCloud: jest.fn(async () => ({ version: 1, changedLocal: false })) }));
jest.mock('@/sync/liveSync', () => ({ startLiveSync: jest.fn(() => jest.fn()) }));
jest.mock('@/sync/googleAuth', () => ({ googleAuth: {} }));
jest.mock('@/sync/deviceName', () => ({ deviceName: () => 'test' }));

const start = jest.mocked(startLiveSync);
const sync = jest.mocked(syncWithCloud);
let listeners: Set<(state: AppStateStatus) => void>;
const initialState = AppState.currentState;
const wrapper = ({ children }: { children: ReactNode }) => <SyncProvider>{children}</SyncProvider>;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockData.expenses = [];
  listeners = new Set();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    const callback = listener as (state: AppStateStatus) => void;
    listeners.add(callback);
    return { remove: () => listeners.delete(callback) };
  });
});
afterEach(() => { jest.restoreAllMocks(); Object.defineProperty(AppState, 'currentState', { configurable: true, value: initialState }); jest.useRealTimers(); });
async function emit(state: AppStateStatus) { await act(async () => { Object.defineProperty(AppState, 'currentState', { configurable: true, value: state }); listeners.forEach(listener => listener(state)); }); }

test('a live hint runs encrypted sync; background/unmount closes connections and foreground reconnects', async () => {
  const hook = await renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  await act(async () => start.mock.calls[0][1]());
  expect(sync.mock.calls.length).toBeGreaterThanOrEqual(2);
  const stop = start.mock.results[0].value;
  const lateHint = start.mock.calls[0][1];
  await emit('background');
  expect(stop).toHaveBeenCalledTimes(1);
  sync.mockClear();
  await act(async () => lateHint());
  expect(sync).not.toHaveBeenCalled();
  await emit('active');
  expect(start).toHaveBeenCalledTimes(2);
  await hook.unmount();
  expect(start.mock.results[1].value).toHaveBeenCalledTimes(1);
});

test('hints received during an active sync queue one follow-up reconciliation', async () => {
  const hook = await renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(hook.result.current.syncing).toBe(false));
  let finish!: (result: { version: number; changedLocal: boolean }) => void;
  sync.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  sync.mockClear();
  await act(async () => { start.mock.calls[0][1](); start.mock.calls[0][1](); start.mock.calls[0][1](); });
  expect(sync).toHaveBeenCalledTimes(1);
  await act(async () => finish({ version: 2, changedLocal: false }));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(sync).toHaveBeenCalledTimes(2);
  await hook.unmount();
});

test('local edits upload after one second and periodic fallback still runs without a hint', async () => {
  const hook = await renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(hook.result.current.lastSyncedAt).not.toBeNull());
  sync.mockClear();
  mockData.expenses = [{ id: 1 }];
  await hook.rerender(undefined);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(sync).toHaveBeenCalledTimes(1);
  sync.mockClear();
  await act(async () => jest.advanceTimersByTime(180_000));
  expect(sync).toHaveBeenCalled();
  await hook.unmount();
});

test('a revoked live connection surfaces a sign-in problem', async () => {
  const hook = await renderHook(() => useSync(), { wrapper });
  await waitFor(() => expect(start).toHaveBeenCalledTimes(1));
  await act(async () => start.mock.calls[0][2]());
  expect(hook.result.current.problem).toBe('signIn');
  await hook.unmount();
});
