import { View } from 'react-native';
import type { Status } from '@/domain/budget';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { IconBadge } from './IconBadge';
import { PressableScale } from './PressableScale';
import { categoryLook, elevation, radius, statusStyle } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  /** Already formatted, e.g. "RM 180.00 left". */
  leftText: string;
  status: Status;
  /** Category name used to pick the tile's icon and colour. */
  tintName: string;
  onPress?: () => void;
};

export function Tile({ title, leftText, status, tintName, onPress }: Props) {
  const { c, scheme } = useTheme();
  const look = categoryLook(tintName);
  const pill = statusStyle(status, scheme);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${leftText}, ${t(`status.${status}`)}`}
      onPress={onPress}
      style={[
        { backgroundColor: c.surface, borderRadius: radius.card, padding: 16, minHeight: 140, justifyContent: 'space-between', gap: 12 },
        scheme === 'dark' ? { borderWidth: 1, borderColor: c.border } : elevation(scheme),
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <IconBadge icon={look.icon} color={look.color} size={38} />
        <View style={{ backgroundColor: pill.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, flexShrink: 1 }}>
          <AppText variant="smallStrong" color={pill.ink} style={{ fontSize: 12, lineHeight: 18 }} numberOfLines={1}>
            {t(`status.${status}`)}
          </AppText>
        </View>
      </View>
      <View style={{ gap: 2 }}>
        <AppText variant="smallStrong" tone="muted">
          {title}
        </AppText>
        <AppText variant="section" style={{ fontSize: 17, lineHeight: 22 }}>
          {leftText}
        </AppText>
      </View>
    </PressableScale>
  );
}
