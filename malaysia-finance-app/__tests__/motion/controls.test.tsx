import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Reanimated from 'react-native-reanimated';
import { Sheet } from '@/ui/Sheet';
import { AppText } from '@/ui/AppText';
import { motionTiming, navigationMotion } from '@/ui/motion';

let mockReduced = false;
jest.mock('@/ui/useMotion', () => ({ useMotion: () => mockReduced }));
beforeEach(() => { mockReduced = false; });
afterEach(() => jest.restoreAllMocks());

test('reduced motion disables every navigation transition and shared timing', () => {
  expect(navigationMotion(true, 'ios')).toEqual({ stack: 'none', tabs: 'none', modal: 'none' });
  expect(navigationMotion(true, 'web').tabs).toBe('none');
  expect(navigationMotion(false, 'android').tabs).toBe('none');
  expect(navigationMotion(false, 'web').tabs).toBe('fade');
  expect(motionTiming('sheet', true).duration).toBe(0);
});

test('user dismissal animates but forced hiding removes a sheet immediately and invalidates its pending close', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming').mockImplementation(value => value);
  const close = jest.fn();
  const ui = (visible: boolean) => <Sheet visible={visible} title="Details" onClose={close}><AppText>Draft content</AppText></Sheet>;
  const view = await render(ui(true));
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(close).not.toHaveBeenCalled();
  const finish = timing.mock.calls.find(([, config, callback]) => config?.duration === 160 && callback)?.[2];
  expect(finish).toBeDefined();
  await view.rerender(ui(false));
  expect(screen.queryByText('Draft content')).toBeNull();
  await act(async () => finish?.(true));
  expect(close).not.toHaveBeenCalled();
  await view.rerender(ui(true));
  await act(async () => finish?.(true));
  expect(screen.getByText('Draft content')).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
  await view.unmount();
});

test('completing a dismissal closes once; reduce motion during dismissal closes immediately', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming').mockImplementation(value => value);
  const close = jest.fn();
  const ui = <Sheet visible title="Details" onClose={close}><AppText>Content</AppText></Sheet>;
  const view = await render(ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  const finish = timing.mock.calls.find(([, config, callback]) => config?.duration === 160 && callback)?.[2];
  expect(finish).toBeDefined();
  await act(async () => finish?.(true));
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => finish?.(true));
  expect(close).toHaveBeenCalledTimes(1);
  await view.unmount();

  close.mockClear(); timing.mockClear();
  const next = await render(ui);
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  const late = timing.mock.calls.find(([, config, callback]) => config?.duration === 160 && callback)?.[2];
  mockReduced = true;
  await next.rerender(<Sheet visible title="Details" onClose={close}><AppText>Content</AppText></Sheet>);
  expect(close).toHaveBeenCalledTimes(1);
  await act(async () => late?.(true));
  expect(close).toHaveBeenCalledTimes(1);
  await next.unmount();
});

test('reduced-motion dismissal does not wait for animation callbacks', async () => {
  mockReduced = true;
  const close = jest.fn();
  const view = await render(<Sheet visible title="Details" onClose={close}><AppText>Content</AppText></Sheet>);
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(close).toHaveBeenCalledTimes(1);
  await view.unmount();
});
