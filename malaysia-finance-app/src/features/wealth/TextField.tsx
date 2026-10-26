import { useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { AppText } from '@/ui/AppText';
import { sanitizeNumber } from '@/ui/numeric';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const NO_WEB_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

type Props = {
  label: string;
  /** Read out instead of `label` when the same label appears more than once on a screen. */
  a11yLabel?: string;
  /** Show only the box (the placeholder says what it is); `label` is still read out. */
  hideLabel?: boolean;
  value: string;
  onChange: (text: string) => void;
  /** Numbers (ages, percentages) bring up the number pad. */
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
  /** Digits allowed after the decimal point in a numeric field; 0 for whole numbers. */
  decimals?: number;
};

/** A labelled text box in the same style as the amount field, for names, notes, ages and percentages. */
export function TextField({ label, a11yLabel, hideLabel = false, value, onChange, numeric = false, placeholder, maxLength, decimals = 3 }: Props) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {hideLabel ? null : <AppText variant="eyebrow" tone="muted">{label}</AppText>}
      <TextInput
        accessibilityLabel={a11yLabel ?? label}
        value={value}
        onChangeText={(text) => onChange(numeric ? sanitizeNumber(text, decimals) : text)}
        keyboardType={numeric ? (decimals > 0 ? 'decimal-pad' : 'number-pad') : 'default'}
        inputMode={numeric ? (decimals > 0 ? 'decimal' : 'numeric') : 'text'}
        placeholder={placeholder}
        placeholderTextColor={c.control}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            height: 50,
            borderRadius: radius.control,
            backgroundColor: c.surface,
            borderWidth: 1.5,
            borderColor: focused ? c.accent : c.border,
            paddingHorizontal: 14,
            color: c.text,
            fontFamily: fontFamily.medium,
            fontSize: 16,
          },
          NO_WEB_OUTLINE,
        ]}
      />
    </View>
  );
}
