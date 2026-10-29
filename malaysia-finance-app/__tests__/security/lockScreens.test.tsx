import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ReceiptPreview } from '@/ui/ReceiptPreview';
import { AppState, Text, TextInput } from 'react-native';
import { useState } from 'react';
import { Screen } from '@/ui/Screen';
import Security from '@/app/security';
import { AppLockGate } from '@/features/security/AppLockGate';
import { getLockState, resetLockForTests, enableLock, lockNow } from '@/security/appLock';
import { mem } from '../../test-support/securityMocks';

jest.mock('expo-crypto', () => require('../../test-support/securityMocks').cryptoMock());
jest.mock('@/security/lockStorage', () => require('../../test-support/securityMocks').lockStorageMock());
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));
const LocalAuth = jest.requireMock('expo-local-authentication');

beforeEach(() => {
  mem.settings = null;
  mem.pin = null;
  resetLockForTests();
  jest.clearAllMocks();
});

const typePin = async (pin: string) => {
  for (const d of pin) await fireEvent.press(screen.getByRole('button', { name: `Digit ${d}` }));
};

describe('App lock settings screen', () => {
  test('turning it on asks for a PIN twice, then switches the lock on', async () => {
    await render(<Security />);
    await fireEvent(screen.getByLabelText('Lock the app'), 'valueChange', true);
    expect(screen.getByText('Create a PIN')).toBeTruthy();
    await typePin('824613');
    await waitFor(() => expect(screen.getByText('Enter the PIN again')).toBeTruthy());
    await typePin('824613');
    await waitFor(() => expect(getLockState().enabled).toBe(true));
    expect(screen.getByText('Lock after leaving the app')).toBeTruthy();
  });

  test('refuses an easy PIN and a PIN that does not match the confirmation', async () => {
    await render(<Security />);
    await fireEvent(screen.getByLabelText('Lock the app'), 'valueChange', true);
    await typePin('123456');
    await waitFor(() => expect(screen.getByText('That PIN is easy to guess. Choose another one.')).toBeTruthy());
    await typePin('824613');
    await waitFor(() => expect(screen.getByText('Enter the PIN again')).toBeTruthy());
    await typePin('824614');
    await waitFor(() => expect(screen.getByText('The PINs did not match. Start again.')).toBeTruthy());
    expect(getLockState().enabled).toBe(false);
  });

  test('turning it off needs the PIN', async () => {
    await enableLock('824613', 6);
    await render(<Security />);
    await fireEvent(screen.getByLabelText('Lock the app'), 'valueChange', false);
    await typePin('000001');
    await waitFor(() => expect(screen.getByText('Wrong PIN. Try again.')).toBeTruthy());
    expect(getLockState().enabled).toBe(true);
    await typePin('824613');
    await waitFor(() => expect(getLockState().enabled).toBe(false));
  });

  test('fingerprint is only switched on after a successful check', async () => {
    await enableLock('824613', 6);
    await render(<Security />);
    await waitFor(() => expect(screen.getByLabelText('Fingerprint / Face ID').props.disabled).toBeFalsy());
    LocalAuth.authenticateAsync.mockResolvedValueOnce({ success: false });
    await fireEvent(screen.getByLabelText('Fingerprint / Face ID'), 'valueChange', true);
    await waitFor(() => expect(LocalAuth.authenticateAsync).toHaveBeenCalledTimes(1));
    expect(getLockState().biometric).toBe(false);
    await fireEvent(screen.getByLabelText('Fingerprint / Face ID'), 'valueChange', true);
    await waitFor(() => expect(getLockState().biometric).toBe(true));
  });
});

describe('AppLockGate', () => {
  const app = async () => render(<AppLockGate><Text>secret balance</Text></AppLockGate>);

  test('shows the app straight away when the lock is off', async () => {
    await app();
    expect(screen.queryByTestId('lock-screen')).toBeNull();
    expect(screen.getByText('secret balance')).toBeTruthy();
  });

  test('covers the app on a cold start until the right PIN is entered', async () => {
    await enableLock('824613', 6);
    resetLockForTests();
    await app();
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    await typePin('000001');
    await waitFor(() => expect(screen.getByText('Wrong PIN. Try again.')).toBeTruthy());
    await typePin('824613');
    await waitFor(() => expect(screen.queryByTestId('lock-screen')).toBeNull());
  });

  test('can unlock with the fingerprint button when it is switched on', async () => {
    await enableLock('824613', 6);
    mem.settings = JSON.stringify({ ...JSON.parse(mem.settings!), biometric: true });
    resetLockForTests();
    await app();
    await waitFor(() => expect(screen.queryByTestId('lock-screen')).toBeNull());
    expect(LocalAuth.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('locks again after the app has been in the background longer than the timeout', async () => {
    await enableLock('824613', 6);
    let listener: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, l: (s: string) => void) => {
      listener = l;
      return { remove: jest.fn() };
    }) as never);
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(0);
    await app();
    expect(screen.queryByTestId('lock-screen')).toBeNull();
    await act(async () => listener('background'));
    now.mockReturnValue(120_000);
    await act(async () => listener('active'));
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
    now.mockRestore();
  });

  test('lockNow covers the app', async () => {
    await enableLock('824613', 6);
    await app();
    await act(async () => lockNow());
    expect(screen.getByTestId('lock-screen')).toBeTruthy();
  });
});

test('dismisses native router modals on cold locked start', async () => {
  const router = jest.requireMock('expo-router').router;
  router.canDismiss = jest.fn(() => true); router.dismissAll = jest.fn();
  await enableLock('824613', 6); resetLockForTests();
  await render(<AppLockGate><Text>private</Text></AppLockGate>);
  expect(router.dismissAll).toHaveBeenCalledTimes(1);
});

test('brief backgrounding covers a modal without discarding its unsaved form', async () => {
  AppState.currentState = 'active';
  const router = jest.requireMock('expo-router').router;
  router.canDismiss = jest.fn(() => true); router.dismissAll = jest.fn();
  const changes = new Set<(state: string) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => {
    changes.add(listener); return { remove: () => changes.delete(listener) };
  }) as never);
  const now = jest.spyOn(Date, 'now').mockReturnValue(100000);
  const Draft = () => {
    const [value, setValue] = useState('');
    return <Screen><TextInput accessibilityLabel="Draft amount" value={value} onChangeText={setValue} /></Screen>;
  };
  await enableLock('824613', 6);
  await render(<AppLockGate><Draft /></AppLockGate>);
  await fireEvent.changeText(screen.getByLabelText('Draft amount'), '12.50');
  await act(async () => { for (const listener of changes) listener('background'); });
  expect(router.dismissAll).not.toHaveBeenCalled();
  expect(screen.getByTestId('screen-privacy-cover')).toBeTruthy();
  now.mockReturnValue(110000);
  await act(async () => { for (const listener of changes) listener('active'); });
  expect(screen.getByLabelText('Draft amount').props.value).toBe('12.50');
  expect(router.dismissAll).not.toHaveBeenCalled();
  now.mockRestore();
});
test('receipt modal is hidden and its owner cleared when locking', async () => {
  AppState.currentState = 'active';
  await enableLock('824613', 6);
  const close = jest.fn();
  await render(<ReceiptPreview uri="file:///dummy.jpg" onClose={close} />);
  expect(screen.getByLabelText('Receipt, full screen')).toBeTruthy();
  await act(async () => lockNow());
  expect(close).toHaveBeenCalled();
  expect(screen.queryByLabelText('Receipt, full screen')).toBeNull();
});


test('receipt owner is cleared when leaving the foreground before lock timeout', async () => {
  AppState.currentState = 'active';
  await enableLock('824613', 6);
  let change: (s: string) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (s: string) => void) => {
    change = listener; return { remove: jest.fn() };
  }) as never);
  const close = jest.fn();
  await render(<ReceiptPreview uri="file:///dummy.jpg" onClose={close} />);
  await act(async () => change('inactive'));
  expect(close).toHaveBeenCalled();
  expect(screen.queryByLabelText('Receipt, full screen')).toBeNull();
  expect(getLockState().locked).toBe(false);
});

test('a receipt provided while backgrounded is cleared instead of reopening on return', async () => {
  AppState.currentState = 'background';
  const close = jest.fn();
  await render(<ReceiptPreview uri="file:///dummy.jpg" onClose={close} />);
  expect(close).toHaveBeenCalled();
});
