import { useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { AppText } from '@/ui/AppText';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const NO_WEB_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

type Props = {
  label: string;
  value: string;
  onChange: (text: string) => void;
  /** Numbers (ages, percentages) bring up the number pad. */
  numeric?: boolean;
  placeholder?: string;
  maxLength?: number;
};

/** A labelled text box in the same style as the amount field, for names, notes, ages and percentages. */
export function TextField({ label, value, onChange, numeric = false, placeholder, maxLength }: Props) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="eyebrow" tone="muted">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        inputMode={numeric ? 'decimal' : 'text'}
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
