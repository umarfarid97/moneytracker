import { TextInput, View } from 'react-native';
import { parseRM, type Sen } from '@/domain/money';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { controlHeight, fontFamily, radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  label: string;
  value: string;
  /** Called on every edit with the text and the parsed amount (null when empty or invalid). */
  onChange: (text: string, sen: Sen | null) => void;
  autoFocus?: boolean;
};

export function AmountInput({ label, value, onChange, autoFocus }: Props) {
  const { c } = useTheme();
  const invalid = value.trim() !== '' && parseRM(value) === null;
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="smallStrong">{label}</AppText>
      <View
        style={{
          height: controlHeight,
          borderRadius: radius.control,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: invalid ? c.negative : c.control,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          gap: 8,
        }}
      >
        <AppText variant="bodyStrong" tone="muted">
          RM
        </AppText>
        <TextInput
          accessibilityLabel={label}
          autoFocus={autoFocus}
          value={value}
          onChangeText={(text) => onChange(text, parseRM(text))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={t('amount.placeholder')}
          placeholderTextColor={c.muted}
          style={{ flex: 1, color: c.text, fontFamily: fontFamily.medium, fontSize: 18, fontVariant: ['tabular-nums'] }}
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
