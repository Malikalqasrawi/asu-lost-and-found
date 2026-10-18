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
    </Stack>
  );
}
