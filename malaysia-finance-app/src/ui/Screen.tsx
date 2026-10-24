import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
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
};

/** Page frame: ground colour, safe area, 20px padding, 16px between blocks. */
export function Screen({ children, scroll = true, fab = false }: Props) {
  const { c } = useTheme();
  const content = { padding: space.pad, gap: space.gap, paddingBottom: fab ? 100 : space.pad };
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.ground }}>
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
      {fab ? <Fab /> : null}
    </SafeAreaView>
  );
}
