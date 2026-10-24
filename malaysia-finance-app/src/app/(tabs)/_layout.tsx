import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { t } from '@/i18n/t';
import type { StringKey } from '@/i18n/en';
import { fontFamily } from '@/ui/theme';
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
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontWeight: '500', fontSize: 11 },
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.border,
          elevation: 0,
          shadowOpacity: 0,
          // Browser previews have no safe-area inset, so give the labels room.
          ...(Platform.OS === 'web' ? { height: 64, paddingBottom: 8 } : null),
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
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? tab.active : tab.icon} size={size} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
