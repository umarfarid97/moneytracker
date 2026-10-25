import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform } from 'react-native';
import { DateFace, fromLocalDate, toLocalDate, type DateFieldProps } from './DateFace';
import { PressableScale } from './PressableScale';
import { Sheet } from './Sheet';
import { useTheme } from './useTheme';

/** Tap to pick a date: Android's calendar dialog, or an inline calendar in a sheet on iOS. */
export function DateField({ value, onChange, label, compact }: DateFieldProps) {
  const { c, scheme } = useTheme();
  const [open, setOpen] = useState(false);

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: toLocalDate(value), mode: 'date', onValueChange: (_, date) => onChange(fromLocalDate(date)) });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: value }} onPress={show} style={{ flex: 1 }}>
        <DateFace value={value} compact={compact} />
      </PressableScale>
      {Platform.OS === 'android' ? null : (
        <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
          <DateTimePicker
            testID="date-picker"
            value={toLocalDate(value)}
            mode="date"
            display="inline"
            accentColor={c.accent}
            themeVariant={scheme}
            onValueChange={(_, date) => {
              onChange(fromLocalDate(date));
              setOpen(false);
            }}
          />
        </Sheet>
      )}
    </>
  );
}
