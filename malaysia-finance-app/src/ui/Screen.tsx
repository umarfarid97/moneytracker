import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fab } from './Fab';
import { space } from './theme';
import { useTheme } from './useTheme';

type Props = {
  children: ReactNode;
  /** Scrolls the content. Pass false when the content is its own list. */
  scroll?: boolean;
  /** Shows the floating "add spending" button. */
  fab?: boolean;
  /** Tighter padding and spacing, for forms that should fit one phone screen. */
  compact?: boolean;
};

const ANIMATE_IN = Platform.OS !== 'android';

/** Page frame: ground colour with a soft wash at the top, safe area, 20px padding, 16px between blocks. */
export function Screen({ children, scroll = true, fab = false, compact = false }: Props) {
  const { c } = useTheme();
  const pad = compact ? space.gap : space.pad;
  const content = { padding: pad, gap: compact ? space.m - 2 : space.gap, paddingBottom: fab ? 100 : pad };
  // Content rises in gently when a screen opens. Not on Android: fading a whole screen there
  // redraws it offscreen every frame, which stutters on tablets.
  const shown = useSharedValue(ANIMATE_IN ? 0 : 1);
  useEffect(() => {
    if (ANIMATE_IN) shown.value = withTiming(1, { duration: 320 });
  }, [shown]);
  const enter = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 10 }] }));
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.ground }}>
      <LinearGradient
        pointerEvents="none"
        colors={c.wash}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
      />
      <Animated.View style={[{ flex: 1 }, enter]}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, content]}>{children}</View>
        )}
      </Animated.View>
      {fab ? <Fab /> : null}
    </SafeAreaView>
  );
}
