import { ReduceMotion } from 'react-native-reanimated';

export const MOTION = {
  pressIn: 90, pressOut: 140, change: 180, screen: 200, sheet: 220,
  dismiss: 160, reorder: 160, progress: 280,
} as const;

export function motionEase(value: number): number {
  'worklet';
  return 1 - (1 - value) ** 3;
}

export function motionTiming(phase: keyof typeof MOTION, reduced: boolean) {
  return { duration: reduced ? 0 : MOTION[phase], easing: motionEase, reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.Never };
}

export function navigationMotion(reduced: boolean, platform: string) {
  return {
    stack: reduced ? 'none' as const : platform === 'web' ? 'fade' as const : 'default' as const,
    tabs: reduced || platform === 'android' ? 'none' as const : 'fade' as const,
    modal: reduced ? 'none' as const : 'slide_from_bottom' as const,
  };
}
