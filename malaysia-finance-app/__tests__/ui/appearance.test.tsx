import { act, render, screen } from '@testing-library/react-native';
import * as RN from 'react-native';
import { Text } from 'react-native';
import { setAppearance } from '@/ui/appearance';
import { useTheme } from '@/ui/useTheme';

function SchemeProbe() {
  const { scheme } = useTheme();
  return <Text>{scheme}</Text>;
}

describe('appearance', () => {
  const colorScheme = jest.spyOn(RN, 'useColorScheme');
  afterAll(() => colorScheme.mockRestore());

  test('opens in the light design even when the device is dark', async () => {
    colorScheme.mockReturnValue('dark');
    await render(<SchemeProbe />);
    expect(screen.getByText('light')).toBeTruthy();
  });

  test('"Match device" follows the device and "Dark" forces dark', async () => {
    colorScheme.mockReturnValue('dark');
    await render(<SchemeProbe />);
    await act(() => setAppearance('system'));
    expect(screen.getByText('dark')).toBeTruthy();
    colorScheme.mockReturnValue('light');
    await act(() => setAppearance('dark'));
    expect(screen.getByText('dark')).toBeTruthy();
    await act(() => setAppearance('light'));
    expect(screen.getByText('light')).toBeTruthy();
  });
});
