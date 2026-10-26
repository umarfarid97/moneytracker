import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AmountInput } from '@/ui/AmountInput';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { ProgressBar } from '@/ui/ProgressBar';
import { Sheet } from '@/ui/Sheet';
import { Tile } from '@/ui/Tile';

describe('Tile', () => {
  test('shows category, amount left and status word, and is pressable', async () => {
    const onPress = jest.fn();
    await render(
      <Tile title="Makan" leftText="RM 180.00 left" status="on-track" tintName="Makan" onPress={onPress} />,
    );
    expect(screen.getByText('Makan')).toBeTruthy();
    expect(screen.getByText('RM 180.00 left')).toBeTruthy();
    expect(screen.getByText('On track')).toBeTruthy();
    await fireEvent.press(screen.getByText('Makan'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('an over-budget tile says so', async () => {
    await render(<Tile title="Hiburan" leftText="RM 60.00 over" status="over" tintName="Hiburan" />);
    expect(screen.getByText('Over budget')).toBeTruthy();
  });
});

describe('AmountInput', () => {
  test('reports the amount in sen for valid text', async () => {
    const onChange = jest.fn();
    await render(<AmountInput label="Amount" value="" onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('Amount'), '1,234.5');
    expect(onChange).toHaveBeenCalledWith('1234.5', 123450);
  });

  test('shows a message and reports null for invalid text', async () => {
    const onChange = jest.fn();
    await render(<AmountInput label="Amount" value="12.999" onChange={onChange} />);
    expect(screen.getByText('Enter an amount like 12.50')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Amount'), 'abc');
    expect(onChange).toHaveBeenCalledWith('', null);
  });

  test('empty input shows no error', async () => {
    await render(<AmountInput label="Amount" value="" onChange={() => {}} />);
    expect(screen.queryByText('Enter an amount like 12.50')).toBeNull();
  });
});

describe('Button', () => {
  test('calls onPress, but not when disabled', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button title="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
    await rerender(<Button title="Save" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Chip', () => {
  test('exposes its selected state', async () => {
    await render(<Chip label="Makan" selected onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Makan' })).toBeSelected();
  });
});

describe('ProgressBar', () => {
  test.each([
    [0.4, 40],
    [1.7, 100],
    [-1, 0],
    [Number.NaN, 0],
  ])('fraction %s reads as %s percent', async (fraction, percent) => {
    await render(<ProgressBar fraction={fraction} />);
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(percent);
  });
});

describe('Sheet', () => {
  test('lifts its content above the keyboard (review finding: the keyboard covered Save)', async () => {
    await render(
      <Sheet visible title="Add" onClose={() => {}}>
        <Text>inside</Text>
      </Sheet>,
    );
    expect(screen.getByTestId('sheet-keyboard-avoider')).toBeTruthy();
  });

  test('renders children only while visible and closes from the close button', async () => {
    const onClose = jest.fn();
    const { rerender } = await render(
      <Sheet visible={false} title="Add spending" onClose={onClose}>
        <Text>inside</Text>
      </Sheet>,
    );
    expect(screen.queryByText('inside')).toBeNull();
    await rerender(
      <Sheet visible title="Add spending" onClose={onClose}>
        <Text>inside</Text>
      </Sheet>,
    );
    expect(screen.getByText('inside')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
