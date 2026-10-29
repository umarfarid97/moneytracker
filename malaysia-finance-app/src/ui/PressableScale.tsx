import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { motionTiming } from './motion';
import { useMotion } from './useMotion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** Scale while pressed. */
  pressedScale?: number;
};

// The style (position, size, flex) goes on the pressable itself: Android only delivers a touch to a view
// inside its parent's bounds, so a pressable wrapping an absolutely placed child never receives taps.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that shrinks slightly under the finger, on the UI thread. */
export function PressableScale({ style, children, pressedScale = 0.98, onPressIn, onPressOut, ...rest }: Props) {
  const reduced = useMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: reduced ? 1 : scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, animated]}
      onPressIn={(e) => {
        scale.value = withTiming(reduced ? 1 : Math.max(0.96, Math.min(1, pressedScale)), motionTiming('pressIn', reduced));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, motionTiming('pressOut', reduced));
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
