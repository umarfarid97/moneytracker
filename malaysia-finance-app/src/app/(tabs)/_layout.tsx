import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { AppText } from '@/ui/AppText';
import { PressableScale } from '@/ui/PressableScale';
import { glow } from '@/ui/theme';
import { THEMES } from '@/ui/themeDefs';
import { useTheme } from '@/ui/useTheme';
import { MOTION, motionEase, navigationMotion } from '@/ui/motion';
import { useMotion } from '@/ui/useMotion';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: StringKey; icon: IconName }[] = [
  { name: 'index', label: 'tab.home', icon: 'home-outline' },
  { name: 'spending', label: 'tab.spending', icon: 'wallet-outline' },
  { name: 'commitments', label: 'tab.commitments', icon: 'calendar-outline' },
  { name: 'more', label: 'tab.more', icon: 'ellipsis-horizontal-circle-outline' },
];
const ICONS = Object.fromEntries(TABS.map((tab) => [tab.name, tab.icon]));

const PLUS = 64;
/** How many tabs sit left of the + (the rest go to its right). */
const LEFT = 2;

/**
 * Bottom bar: line icons with labels, the active tab in blue, and a large round blue + in the middle that
 * adds spending (it opens the Add spending screen; it is not a tab).
 */
function TabBar({ state, descriptors, navigateToTab, emitter }: BottomTabBarProps) {
  const { c, scheme, theme } = useTheme();
  const indicator = THEMES[theme].tabIndicator;
  const green = indicator !== 'none';
  const drop = indicator === 'drop';
  const bordered = theme !== 'classic';
  const insets = useSafeAreaInsets();

  const item = (index: number) => {
    const route = state.routes[index];
    const focused = index === state.index;
    const label = descriptors[route.key].options.title ?? route.name;
    const color = focused ? c.accent : green ? c.muted : c.text;
    const iconColor = drop && focused ? c.onAccent : color;
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigateToTab(route.key);
    };
    return (
      <PressableScale
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: green ? 2 : 4, paddingTop: green ? 8 : 10 }}
      >
        {green ? (
          // The coloured themes: the active tab sits in a soft pill with a glow (Mint dark: a solid drop).
          <View
            style={[
              drop
                ? { width: 34, height: 34, marginBottom: 5, borderTopLeftRadius: 17, borderTopRightRadius: 17, borderBottomLeftRadius: 17, borderBottomRightRadius: 5, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }
                : { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
              focused ? [{ backgroundColor: drop ? c.accent : c.accentSoft }, glow(c.accent, scheme)] : null,
            ]}
          >
            <Ionicons name={ICONS[route.name] ?? 'ellipse-outline'} size={24} color={iconColor} style={drop ? { transform: [{ rotate: '-45deg' }] } : undefined} />
          </View>
        ) : (
          <Ionicons name={ICONS[route.name] ?? 'ellipse-outline'} size={25} color={color} />
        )}
        <AppText variant="small" color={color} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
          {label}
        </AppText>
      </PressableScale>
    );
  };

  const left = state.routes.slice(0, LEFT).map((_, i) => item(i));
  const right = state.routes.slice(LEFT).map((_, i) => item(LEFT + i));
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        height: 72 + insets.bottom,
        paddingBottom: insets.bottom + 6,
        backgroundColor: c.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: bordered ? 1 : 0,
        borderLeftWidth: green ? 1 : 0,
        borderRightWidth: green ? 1 : 0,
        borderColor: c.border,
        shadowColor: '#0b1530',
        shadowOpacity: scheme === 'dark' ? 0 : 0.07,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>{left}</View>
      <View style={{ width: PLUS + 16, alignItems: 'center' }}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('expense.add')}
          onPress={() => router.push('/add-expense')}
          pressedScale={0.92}
          style={[
            {
              marginTop: -PLUS / 3,
              width: PLUS,
              height: PLUS,
              borderRadius: PLUS / 2,
              backgroundColor: c.accent,
              alignItems: 'center',
              justifyContent: 'center',
            },
            glow(c.accent, scheme),
          ]}
        >
          <Ionicons name="add" size={36} color={c.onAccent} />
        </PressableScale>
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>{right}</View>
    </View>
  );
}

export default function TabsLayout() {
  const { c } = useTheme();
  const reduced = useMotion();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, animation: navigationMotion(reduced, Platform.OS).tabs, transitionSpec: { animation: 'timing', config: { duration: reduced ? 0 : MOTION.change, easing: motionEase } }, sceneStyle: { backgroundColor: c.ground } }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: t(tab.label) }} />
      ))}
    </Tabs>
  );
}
