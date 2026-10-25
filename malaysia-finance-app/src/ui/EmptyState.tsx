import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { AppText } from './AppText';
import { useTheme } from './useTheme';

type Props = { icon: keyof typeof Ionicons.glyphMap; text: string; hint?: string };

/** Friendly placeholder for an empty list: a tinted icon bubble and a line of text. */
export function EmptyState({ icon, text, hint }: Props) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={34} color={c.accent} />
      </View>
      <AppText variant="bodyStrong" style={{ textAlign: 'center' }}>
        {text}
      </AppText>
      {hint ? (
        <AppText variant="small" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
