import { View } from 'react-native';
import { DateFace, type DateFieldProps } from './DateFace';

/**
 * Browsers have their own date picker: an invisible <input type="date"> lies over the field,
 * so a tap opens the phone's date wheel or the desktop calendar.
 */
export function DateField({ value, onChange, label, compact }: DateFieldProps) {
  return (
    <View style={{ flex: 1 }}>
      <DateFace value={value} compact={compact} />
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        // Desktop Chrome only opens the calendar from its icon unless asked; 16px text stops iOS zooming in.
        onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 0, padding: 0, margin: 0, fontSize: 16 }}
      />
    </View>
  );
}
