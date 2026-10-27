import { TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { controlHeight, fontFamily, radius } from './theme';
import { useTheme } from './useTheme';

type Props = Pick<TextInputProps, 'value' | 'onChangeText' | 'keyboardType' | 'autoCapitalize' | 'maxLength' | 'autoComplete' | 'textContentType'> & {
  label: string;
  secure?: boolean;
  placeholder?: string;
};

/** A labelled single-line text box in the app's form style. */
export function TextField({ label, secure = false, placeholder, ...input }: Props) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="smallStrong" tone="muted">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        {...input}
        style={{
          height: controlHeight,
          borderRadius: radius.control,
          backgroundColor: c.ground,
          paddingHorizontal: 14,
          color: c.text,
          fontFamily: fontFamily.medium,
          fontSize: 16,
        }}
      />
    </View>
  );
}
