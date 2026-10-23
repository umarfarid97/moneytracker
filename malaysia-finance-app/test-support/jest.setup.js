// Reanimated's own jest mode needs a browser DOM, so tests use this small stand-in:
// animated styles resolve immediately and timings jump straight to their target.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: (factory) => factory(),
    withTiming: (value) => value,
    withSpring: (value) => value,
    runOnJS: (fn) => fn,
  };
});
// Gesture handlers only matter on a device; tests need the components to render.
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const chain = () => new Proxy({}, { get: () => () => chain() });
  return {
    __esModule: true,
    Gesture: { Pan: chain },
    GestureDetector: ({ children }) => children,
    GestureHandlerRootView: View,
  };
});
