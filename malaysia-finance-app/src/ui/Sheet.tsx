import { useEffect, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n/t';
import { AppText } from './AppText';
import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Save/Cancel buttons: pinned under the scrolling content so they never scroll away. */
  footer?: ReactNode;
  /** A full-screen page instead of a bottom sheet, with the title centred between a back arrow and a close cross. */
  tall?: boolean;
  /** Shows a back arrow on the left of a `tall` sheet. */
  onBack?: () => void;
};

const OFFSCREEN = 700;
const DISMISS_DISTANCE = 120;

/** Bottom sheet: slides up, closes by dragging down, the backdrop or the close button. */
export function Sheet({ visible, title, onClose, children, footer, tall = false, onBack }: Props) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
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
  if (tall) {
    return (
      <Modal animationType="slide" visible onRequestClose={onClose} statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.ground }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ width: 32 }}>
                {onBack ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={t('addflow.back')} onPress={onBack} hitSlop={12}>
                    <Ionicons name="chevron-back" size={24} color={c.text} />
                  </Pressable>
                ) : null}
              </View>
              <AppText variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'center' }}>{title}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={12} style={{ width: 32, alignItems: 'flex-end' }}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 4 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {footer ? <View testID="sheet-footer" style={{ padding: 16 }}>{footer}</View> : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  }
  return (
    <Modal transparent animationType="none" visible onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' }, backdropStyle]}>
          <Pressable accessibilityLabel={t('common.dismiss')} style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        <KeyboardAvoidingView
          testID="sheet-keyboard-avoider"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          pointerEvents="box-none"
        >
        <Animated.View
          style={[
            { backgroundColor: c.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 16 },
            sheetStyle,
          ]}
        >
          {/* Only the handle and title row drag the sheet closed, so scrolling the content below never closes it. */}
          <GestureDetector gesture={drag}>
            <View style={{ gap: 16 }}>
              <View style={{ alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: c.control }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="section">{title}</AppText>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={12}>
                  <AppText variant="bodyStrong" tone="muted">
                    {t('common.close')}
                  </AppText>
                </Pressable>
              </View>
            </View>
          </GestureDetector>
          {/* Long forms scroll inside the sheet instead of running off the screen. */}
          <ScrollView style={{ maxHeight: height * 0.7 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
          {footer ? <View testID="sheet-footer">{footer}</View> : null}
        </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}
