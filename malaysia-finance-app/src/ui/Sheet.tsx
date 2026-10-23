import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = { visible: boolean; title: string; onClose: () => void; children: ReactNode };

const OFFSCREEN = 700;
const DISMISS_DISTANCE = 120;

/** Bottom sheet: slides up, closes by dragging down, the backdrop or the close button. */
export function Sheet({ visible, title, onClose, children }: Props) {
  const { c } = useTheme();
  const y = useSharedValue(OFFSCREEN);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      y.value = withTiming(0, { duration: 260 });
      backdrop.value = withTiming(1, { duration: 260 });
    } else {
      y.value = OFFSCREEN;
      backdrop.value = 0;
    }
  }, [visible, y, backdrop]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_DISTANCE) runOnJS(onClose)();
      else y.value = withTiming(0, { duration: 180 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.4 }));

  if (!visible) return null;
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' }, backdropStyle]}>
          <Pressable accessibilityLabel={t('common.dismiss')} style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <GestureDetector gesture={drag}>
          <Animated.View
            style={[
              { backgroundColor: c.surface, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, padding: 20, paddingBottom: 32, gap: 16 },
              sheetStyle,
            ]}
          >
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.control }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="section">{title}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={12}>
                <AppText variant="bodyStrong" tone="muted">
                  {t('common.close')}
                </AppText>
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
