import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { t } from '@/i18n/t';
import { AppText } from '@/ui/AppText';
import { PressableScale } from '@/ui/PressableScale';
import { useTheme } from '@/ui/useTheme';

type Props = {
  /** The digits typed so far. */
  value: string;
  length: number;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Shown bottom-left, e.g. the fingerprint button. */
  extraKey?: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };
};

const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
const KEY = 72;

/** Dots plus a digit keypad. Only digits can be entered, so there is no keyboard and nothing to sanitise. */
export function PinPad({ value, length, onChange, disabled = false, extraKey }: Props) {
  const { c } = useTheme();
  const press = (digit: string) => {
    if (!disabled && value.length < length) onChange(value + digit);
  };
  const key = (children: React.ReactNode, onPress: () => void, label: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{ width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}
    >
      {children}
    </PressableScale>
  );
  const blank = <View style={{ width: KEY, height: KEY }} />;
  return (
    <View style={{ alignItems: 'center', gap: 28 }}>
      <View accessible accessibilityLabel={`${value.length} / ${length}`} style={{ flexDirection: 'row', gap: 14 }}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 2,
              borderColor: c.accent,
              backgroundColor: i < value.length ? c.accent : 'transparent',
            }}
          />
        ))}
      </View>
      <View style={{ gap: 16 }}>
        {ROWS.map((row) => (
          <View key={row[0]} style={{ flexDirection: 'row', gap: 24 }}>
            {row.map((d) => (
              <View key={d}>
                {key(<AppText variant="section">{d}</AppText>, () => press(d), t('lock.digit', { digit: d }))}
              </View>
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 24 }}>
          {extraKey
            ? key(<Ionicons name={extraKey.icon} size={28} color={c.accent} />, extraKey.onPress, extraKey.label)
            : blank}
          {key(<AppText variant="section">0</AppText>, () => press('0'), t('lock.digit', { digit: '0' }))}
          {key(<Ionicons name="backspace-outline" size={28} color={c.text} />, () => onChange(value.slice(0, -1)), t('lock.delete'))}
        </View>
      </View>
    </View>
  );
}
