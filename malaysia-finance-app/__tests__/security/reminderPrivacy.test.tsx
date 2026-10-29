import { act, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { RemindersSync } from '@/features/commitments/RemindersSync';
import { enableLock, resetLockForTests } from '@/security/appLock';
import { mem } from '../../test-support/securityMocks';
jest.mock('expo-crypto', () => jest.requireActual('../../test-support/securityMocks').cryptoMock());
jest.mock('@/security/lockStorage', () => jest.requireActual('../../test-support/securityMocks').lockStorageMock());
jest.mock('@/hooks/useCommitments', () => { const data: unknown[] = []; return { useCommitments: () => ({ data }) }; });
jest.mock('@/hooks/useExpenses', () => { const data: unknown[] = []; return { useExpenses: () => ({ data }) }; });
jest.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ data: { reminderDays: 1 } }) }));
jest.mock('@/notifications', () => ({ configureNotifications: jest.fn(), scheduleReminders: jest.fn(async () => 0) }));
const { scheduleReminders } = jest.requireMock('@/notifications');
beforeEach(() => { mem.settings = null; mem.pin = null; mem.failWrite = false; resetLockForTests(); jest.clearAllMocks(); });
test('enabling lock rebuilds reminders even when financial data is unchanged', async () => {
  await render(<RemindersSync />);
  await waitFor(() => expect(scheduleReminders).toHaveBeenCalledTimes(1));
  await act(async () => enableLock('824613', 6));
  await waitFor(() => expect(scheduleReminders).toHaveBeenCalledTimes(2));
});
test('failed privacy replacement offers a retry', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  scheduleReminders.mockRejectedValueOnce(new Error('cancel failed'));
  await render(<RemindersSync />);
  await waitFor(() => expect(alert).toHaveBeenCalled());
  const retry = alert.mock.calls[0][2]!.find(button => button.text === 'Retry')!;
  await act(async () => retry.onPress!());
  expect(scheduleReminders).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});
