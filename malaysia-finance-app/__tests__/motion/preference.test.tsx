import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useMotion } from '@/ui/useMotion';

let resolve: (value: boolean) => void;
let event: (value: boolean) => void;
const remove = jest.fn();
beforeEach(() => {
  remove.mockClear();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(() => new Promise(r => { resolve = r; }));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_name, listener) => {
    event = listener as (value: boolean) => void;
    return { remove };
  });
});
afterEach(() => jest.restoreAllMocks());

test('native controls share one live preference listener and clean it up after the last subscriber', async () => {
  const first = await renderHook(useMotion);
  const second = await renderHook(useMotion);
  expect(first.result.current).toBe(true);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
  await act(async () => resolve(false));
  expect(first.result.current).toBe(false);
  expect(second.result.current).toBe(false);
  await act(async () => event(true));
  expect(first.result.current).toBe(true);
  await first.unmount();
  expect(remove).not.toHaveBeenCalled();
  await second.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});

test('a late initial query cannot override a newer accessibility event or a remounted subscription', async () => {
  const first = await renderHook(useMotion);
  const staleResolve = resolve;
  await act(async () => event(false));
  await act(async () => staleResolve(true));
  expect(first.result.current).toBe(false);
  await first.unmount();
  const second = await renderHook(useMotion);
  await act(async () => resolve(false));
  await act(async () => staleResolve(true));
  expect(second.result.current).toBe(false);
  await second.unmount();
});

test('an unavailable native preference leaves motion reduced', async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValueOnce(new Error('unavailable'));
  const hook = await renderHook(useMotion);
  await act(async () => {});
  expect(hook.result.current).toBe(true);
  await hook.unmount();
});
