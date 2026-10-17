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
    </Stack>
  );
}
