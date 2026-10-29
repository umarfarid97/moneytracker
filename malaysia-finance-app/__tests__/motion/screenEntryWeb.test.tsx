import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import { ScreenEntry } from '@/ui/ScreenEntry.web';

let mockSegments = ['profile'];
let mockReduced = false;
let mockFocus: () => void;
jest.mock('expo-router', () => ({ useSegments: () => mockSegments, useFocusEffect: (callback: () => void) => { mockFocus = callback; } }));
jest.mock('@/ui/useMotion', () => ({ useMotion: () => mockReduced }));
beforeEach(() => { mockSegments = ['profile']; mockReduced = false; });
afterEach(() => jest.restoreAllMocks());

test('web non-tab screens animate on focus and return focus, without animating tabs twice', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const view = await render(<ScreenEntry><Text>Draft</Text></ScreenEntry>);
  await act(async () => mockFocus());
  expect(timing).toHaveBeenCalledWith(1, expect.objectContaining({ duration: 200 }));
  timing.mockClear();
  await act(async () => mockFocus());
  expect(timing).toHaveBeenCalledTimes(1);
  mockSegments = ['(tabs)', 'index'];
  await view.rerender(<ScreenEntry><Text>Home</Text></ScreenEntry>);
  timing.mockClear();
  await act(async () => mockFocus());
  expect(timing).not.toHaveBeenCalled();
  await view.unmount();
});

test('changing reduced motion does not replay entry and subsequent focus stays immediate', async () => {
  const timing = jest.spyOn(Reanimated, 'withTiming');
  const view = await render(<ScreenEntry><Text>Draft</Text></ScreenEntry>);
  await act(async () => mockFocus());
  timing.mockClear();
  mockReduced = true;
  await view.rerender(<ScreenEntry><Text>Draft</Text></ScreenEntry>);
  expect(timing).not.toHaveBeenCalled();
  await act(async () => mockFocus());
  expect(timing).not.toHaveBeenCalled();
  await view.unmount();
});
