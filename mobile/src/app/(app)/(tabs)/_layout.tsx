import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
      }}>
      <Tabs.Screen name="browse" options={{ title: 'Browse', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="mine" options={{ title: 'My posts', tabBarIcon: icon('albums-outline') }} />
      <Tabs.Screen
        name="claims"
        options={{ title: 'My claims', tabBarIcon: icon('hand-left-outline') }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: icon('person-circle-outline') }}
      />
    </Tabs>
  );
}
