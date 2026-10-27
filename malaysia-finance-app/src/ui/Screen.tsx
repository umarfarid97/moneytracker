import { useEffect, type ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from './theme';
import { useTheme } from './useTheme';

type Props = {
  children: ReactNode;
  /**
   * Scrolls the content. Pass false when the content is its own list: the list then runs to the bottom edge
   * and supplies its own side and bottom padding, so rows aren't cut off above the tab bar.
   */
  scroll?: boolean;
  /** Leaves room at the bottom for the tab bar's raised + button. */
  fab?: boolean;
  /** Tighter padding and spacing, for forms that should fit one phone screen. */
  compact?: boolean;
  /** Pinned under the content, e.g. a form's Save button. The content then stretches to fill the height. */
  footer?: ReactNode;
};

const ANIMATE_IN = Platform.OS !== 'android';

/** Page frame: plain ground colour, safe area, 20px padding, 16px between blocks. */
export function Screen({ children, scroll = true, fab = false, compact = false, footer }: Props) {
  const { c } = useTheme();
  const pad = compact ? space.gap : space.pad;
  const content = {
    padding: pad,
    // On a desktop browser the content stays a readable width instead of stretching edge to edge.
    width: '100%' as const,
    maxWidth: 1000,
    alignSelf: 'center' as const,
    gap: compact ? space.m - 2 : space.gap,
    paddingBottom: fab ? 100 : pad,
    ...(footer ? { flexGrow: 1 } : null),
  };
  // Content rises in gently when a screen opens. Not on Android: fading a whole screen there
  // redraws it offscreen every frame, which stutters on tablets.
  const shown = useSharedValue(ANIMATE_IN ? 0 : 1);
  useEffect(() => {
    if (ANIMATE_IN) shown.value = withTiming(1, { duration: 320 });
  }, [shown]);
  const enter = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: (1 - shown.value) * 10 }] }));
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.ground }}>
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
          <View style={{ flex: 1, paddingTop: pad }}>{children}</View>
        )}
        {footer ? (
          <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: pad, paddingTop: 12, paddingBottom: pad, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.ground }}>
            {footer}
          </SafeAreaView>
        ) : null}
      </Animated.View>
    </SafeAreaView>
  );
}
