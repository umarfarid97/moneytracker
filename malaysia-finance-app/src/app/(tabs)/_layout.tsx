import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { fontFamily, radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type IconName = keyof typeof Ionicons.glyphMap;

const TABS: { name: string; label: StringKey; icon: IconName; active: IconName }[] = [
  { name: 'index', label: 'tab.home', icon: 'home-outline', active: 'home' },
  { name: 'spending', label: 'tab.spending', icon: 'wallet-outline', active: 'wallet' },
  { name: 'commitments', label: 'tab.commitments', icon: 'calendar-outline', active: 'calendar' },
  { name: 'tax', label: 'tab.tax', icon: 'document-text-outline', active: 'document-text' },
  { name: 'more', label: 'tab.more', icon: 'ellipsis-horizontal-circle-outline', active: 'ellipsis-horizontal-circle' },
];

export default function TabsLayout() {
  const { c, scheme } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        // Tablets would otherwise put the label beside a squeezed icon.
        tabBarLabelPosition: 'below-icon',
        tabBarIconStyle: { width: 56, height: 30 },
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontWeight: '600', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopWidth: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          shadowColor: '#3b3a8f',
          shadowOpacity: scheme === 'dark' ? 0 : 0.08,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
          paddingTop: 6,
          // Browser previews have no safe-area inset, so give the labels room.
          ...(Platform.OS === 'web' ? { height: 70, paddingBottom: 10 } : null),
        },
        sceneStyle: { backgroundColor: c.ground },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            // The active tab's icon sits in a tinted capsule, like iOS 18's tab bars.
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 56,
                  height: 30,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  backgroundColor: focused ? c.accentSoft : 'transparent',
                }}
              >
                <Ionicons name={focused ? tab.active : tab.icon} size={22} color={String(color)} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
