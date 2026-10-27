import { useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { parseRM, type Sen } from '@/domain/money';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { sanitizeNumber } from './numeric';
import { elevation, fontFamily, radius } from './theme';
import { useTheme } from './useTheme';

/** Browsers draw their own focus ring inside the field; the field's border shows focus instead. */
const NO_WEB_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

type Props = {
  label: string;
  value: string;
  /** Called on every edit with the text and the parsed amount (null when empty or invalid). */
  onChange: (text: string, sen: Sen | null) => void;
  autoFocus?: boolean;
  compact?: boolean;
  /** A bigger field for wide screens, where the amount leads the form. */
  large?: boolean;
  /** Greyed hint in the empty field; defaults to the standard 0.00 hint. */
  placeholder?: string;
};

export function AmountInput({ label, value, onChange, autoFocus, compact = false, large = false, placeholder }: Props) {
  const { c, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const invalid = value.trim() !== '' && parseRM(value) === null;
  return (
    <View style={{ gap: compact ? 4 : 8 }}>
      <AppText variant="eyebrow" tone="muted">{label}</AppText>
      <View
        style={[
          {
            height: large ? 88 : compact ? 56 : 64,
            borderRadius: radius.control + 2,
            backgroundColor: c.surface,
            borderWidth: 1.5,
            borderColor: invalid ? c.negative : focused ? c.accent : c.border,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 10,
          },
          elevation(scheme),
        ]}
      >
        <View style={{ backgroundColor: c.accentSoft, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 }}>
          <AppText variant="smallStrong" color={c.accentInk}>RM</AppText>
        </View>
        <TextInput
          accessibilityLabel={label}
          autoFocus={autoFocus}
          value={value}
          onChangeText={(raw) => {
            const text = sanitizeNumber(raw);
            onChange(text, parseRM(text));
          }}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={placeholder ?? t('amount.placeholder')}
          placeholderTextColor={c.control}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{ flex: 1, minWidth: 0, color: c.text, fontFamily: fontFamily.bold, fontSize: large ? 40 : compact ? 26 : 28, fontVariant: ['tabular-nums'] }, NO_WEB_OUTLINE]}
        />
      </View>
      {invalid ? (
        <AppText variant="small" tone="negative">
          {t('amount.invalid')}
        </AppText>
      ) : null}
    </View>
  );
}
