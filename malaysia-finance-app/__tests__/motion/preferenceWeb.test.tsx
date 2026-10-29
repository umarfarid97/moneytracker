import { act, renderHook } from '@testing-library/react-native';
import { useMotion } from '@/ui/useMotion.web';

test('browser preference changes update existing controls and release the media-query listener', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let listener: () => void = () => {};
  const media = { matches: false, addEventListener: jest.fn((_type, callback) => { listener = callback; }), removeEventListener: jest.fn() };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: jest.fn(() => media) } });
  try {
    const hook = await renderHook(useMotion);
    expect(hook.result.current).toBe(false);
    await act(async () => { media.matches = true; listener(); });
    expect(hook.result.current).toBe(true);
    await hook.unmount();
    expect(media.removeEventListener).toHaveBeenCalledTimes(1);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
