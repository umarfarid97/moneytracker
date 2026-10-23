import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = { children: ReactNode; onDelete: () => void };

/** Row that reveals a Delete action when swiped left. */
export function SwipeRow({ children, onDelete }: Props) {
  const { c } = useTheme();
  return (
    <View style={{ borderRadius: radius.control, overflow: 'hidden' }}>
    <Swipeable
      overshootRight={false}
      friction={2}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
          onPress={onDelete}
          style={{
            width: 88,
            marginLeft: 8,
            borderRadius: radius.control,
            backgroundColor: c.negative,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText variant="bodyStrong" color="#ffffff">
            {t('common.delete')}
          </AppText>
        </Pressable>
      )}
    >
      {children}
    </Swipeable>
    </View>
  );
}
