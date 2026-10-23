import { View } from 'react-native';
import type { Status } from '@/domain/budget';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';
import { categoryTint, radius, statusStyle } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  /** Already formatted, e.g. "RM 180.00 left". */
  leftText: string;
  status: Status;
  /** Category name used to pick the tile's pale tint. */
  tintName: string;
  onPress?: () => void;
};

export function Tile({ title, leftText, status, tintName, onPress }: Props) {
  const { scheme } = useTheme();
  const tint = categoryTint(tintName, scheme);
  const pill = statusStyle(status, scheme);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${leftText}, ${t(`status.${status}`)}`}
      onPress={onPress}
      style={{ backgroundColor: tint.bg, borderRadius: radius.card, padding: 16, minHeight: 124, justifyContent: 'space-between', gap: 12 }}
    >
      <View style={{ gap: 4 }}>
        <AppText variant="smallStrong" color={tint.ink}>
          {title}
        </AppText>
        <AppText variant="section" color={tint.ink}>
          {leftText}
        </AppText>
      </View>
      <View style={{ alignSelf: 'flex-start', backgroundColor: pill.bg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
        <AppText variant="smallStrong" color={pill.ink}>
          {t(`status.${status}`)}
        </AppText>
      </View>
    </PressableScale>
  );
}
