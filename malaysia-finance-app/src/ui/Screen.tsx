import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space } from './theme';
import { useTheme } from './useTheme';

type Props = { children: ReactNode; scroll?: boolean };

/** Page frame: ground colour, safe area, 20px padding, 16px between blocks. */
export function Screen({ children, scroll = true }: Props) {
  const { c } = useTheme();
  const content = { padding: space.pad, gap: space.gap };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.ground }}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
