import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { isValidDate, shortDate } from '@/domain/dates';
import { AppText } from './AppText';
import { radius } from './theme';
import { useTheme } from './useTheme';

/** What a date field shows: a calendar icon and "Sun 25 Oct 2026". */
export function DateFace({ value, compact = false }: { value: string; compact?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        height: compact ? 36 : 44,
        borderRadius: radius.control,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <Ionicons name="calendar" size={16} color={c.accent} />
      <AppText variant="smallStrong" numberOfLines={1} style={{ flex: 1 }}>
        {isValidDate(value) ? `${shortDate(value)} ${value.slice(0, 4)}` : value}
      </AppText>
      <Ionicons name="chevron-down" size={14} color={c.muted} />
    </View>
  );
}

/** `YYYY-MM-DD` to a local Date at midnight, and back. */
export function toLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return isValidDate(value) ? new Date(y, m - 1, d) : new Date();
}

export function fromLocalDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type DateFieldProps = {
  /** `YYYY-MM-DD`. */
  value: string;
  onChange: (value: string) => void;
  /** Spoken name, and the picker's title. */
  label: string;
  compact?: boolean;
};
