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
  /** Null for a category without a budget: the pill says so instead of a status. */
  status: Status | null;
  /** Optional line under the main text, e.g. what was spent. */
  detail?: string;
  /** Category name used to pick the tile's icon and colour. */
  tintName: string;
  onPress?: () => void;
};

export function Tile({ title, leftText, status, detail, tintName, onPress }: Props) {
  const { c, scheme } = useTheme();
  const look = categoryLook(tintName);
  const pill = status ? statusStyle(status, scheme) : { bg: c.ground, ink: c.muted };
  const pillText = status ? t(`status.${status}`) : t('status.none');
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, leftText, detail, pillText].filter(Boolean).join(', ')}
      onPress={onPress}
      style={[
        { flex: 1, backgroundColor: c.surface, borderRadius: radius.card, padding: 14, gap: 10, justifyContent: 'space-between' },
        scheme === 'dark' ? { borderWidth: 1, borderColor: c.border } : elevation(scheme),
      ]}
    >
      {/* Icon and name share one line at matching sizes; the figure sits under them, then the status. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconBadge icon={look.icon} color={look.color} size={28} />
        <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>
          {title}
        </AppText>
      </View>
      <View style={{ gap: 8 }}>
        <AppText
          variant="section"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ fontSize: 17, lineHeight: 22 }}
        >
          {leftText}
        </AppText>
        {detail ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
        <View style={{ alignSelf: 'flex-start', backgroundColor: pill.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 }}>
          <AppText variant="smallStrong" color={pill.ink} style={{ fontSize: 12, lineHeight: 18 }} numberOfLines={1}>
            {pillText}
          </AppText>
        </View>
      </View>
    </PressableScale>
  );
}
