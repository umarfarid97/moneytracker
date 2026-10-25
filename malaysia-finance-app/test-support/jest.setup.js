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

// Native modules and navigation that screens import but unit tests do not need.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: ({ name }) => React.createElement(Text, null, name) };
});
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
// The native date picker renders as a plain View whose onValueChange tests can call.
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props) => React.createElement(View, props),
    DateTimePickerAndroid: { open: jest.fn() },
  };
});
