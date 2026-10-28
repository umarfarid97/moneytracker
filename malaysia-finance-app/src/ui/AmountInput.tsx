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
  /** Marks the label with a red asterisk. */
  required?: boolean;
  /** A flat form field like the other inputs in a form: 50 high, thin border, no shadow, a label in the form's style. */
  plain?: boolean;
};

export function AmountInput({ label, value, onChange, autoFocus, compact = false, large = false, placeholder, required = false, plain = false }: Props) {
  const { c, scheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const invalid = value.trim() !== '' && parseRM(value) === null;
  return (
    <View style={{ gap: compact ? 4 : 8 }}>
      {plain ? (
        <AppText variant="smallStrong">
          {label}
          {required ? <AppText variant="smallStrong" color={c.negative}> *</AppText> : null}
        </AppText>
      ) : (
        <AppText variant="eyebrow" tone="muted">
          {label}
          {required ? <AppText variant="eyebrow" color={c.negative}> *</AppText> : null}
        </AppText>
      )}
      <View
        style={[
          {
            height: plain ? 50 : large ? 88 : compact ? 56 : 64,
            borderRadius: plain ? radius.control : radius.control + 2,
            backgroundColor: c.surface,
            borderWidth: plain ? 1 : 1.5,
            borderColor: invalid ? c.negative : focused ? c.accent : plain ? c.control : c.border,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 10,
          },
          plain ? null : elevation(scheme),
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
          placeholderTextColor={plain ? c.muted : c.control}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{ flex: 1, minWidth: 0, color: c.text, fontFamily: plain ? fontFamily.medium : fontFamily.bold, fontSize: plain ? 16 : large ? 40 : compact ? 26 : 28, fontVariant: ['tabular-nums'] }, NO_WEB_OUTLINE]}
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
