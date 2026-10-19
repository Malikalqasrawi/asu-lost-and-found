import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="posts/new"
        options={{ title: 'Post an item', presentation: 'modal' }}
      />
      <Stack.Screen name="posts/[id]" options={{ title: '' }} />
      <Stack.Screen
        name="posts/[id]/claim"
        options={{ title: 'Claim this item', presentation: 'modal' }}
      />
      <Stack.Screen name="posts/[id]/claims" options={{ title: 'Claims' }} />
      <Stack.Screen name="posts/[id]/chat" options={{ title: 'Messages' }} />
      <Stack.Screen name="report" options={{ title: 'Report', presentation: 'modal' }} />
      <Stack.Screen
        name="account/change-email"
        options={{ title: 'Change email', presentation: 'modal' }}
      />
      <Stack.Screen
        name="account/delete"
        options={{ title: 'Delete account', presentation: 'modal' }}
      />
      <Stack.Screen
        name="posts/[id]/pickup"
        options={{ title: 'Pickup code', presentation: 'modal' }}
      />
    </Stack>
  );
}
