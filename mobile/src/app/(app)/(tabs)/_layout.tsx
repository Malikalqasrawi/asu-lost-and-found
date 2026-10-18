import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useMyHandovers } from '@/api/handovers';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useSession();
  const handovers = useMyHandovers();
  const unread = (handovers.data ?? []).reduce((sum, handover) => sum + handover.unread, 0);

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
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: icon('chatbubbles-outline'),
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />
      <Tabs.Screen
        name="desk"
        options={{
          title: 'Desk',
          tabBarIcon: icon('shield-checkmark-outline'),
          href: user?.role === 'SECURITY' ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: icon('person-circle-outline') }}
      />
    </Tabs>
  );
}
