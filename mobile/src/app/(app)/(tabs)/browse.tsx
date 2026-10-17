import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { usePosts, type PostType } from '@/api/posts';
import { Chip } from '@/components/chip';
import { PostList } from '@/components/post-list';
import { ThemedText } from '@/components/themed-text';
import { typeLabels } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

const filters: { label: string; type?: PostType }[] = [
  { label: 'All' },
  { label: typeLabels.FOUND, type: 'FOUND' },
  { label: typeLabels.LOST, type: 'LOST' },
];

export default function BrowseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const [type, setType] = useState<PostType | undefined>();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const posts = usePosts({ type, q: q || undefined });
  const items = useMemo(() => posts.data?.pages.flatMap((page) => page.items) ?? [], [posts.data]);
  const firstName = user?.fullName.split(' ')[0];

  return (
    <PostList
      posts={items}
      query={posts}
      emptyText={q ? `Nothing matches "${q}".` : 'No posts yet. Lost or found something? Post it.'}
      onEndReached={() => {
        if (posts.hasNextPage && !posts.isFetchingNextPage) {
          void posts.fetchNextPage();
        }
      }}
      header={
        <>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Hi, {firstName}
              </ThemedText>
              <ThemedText type="subtitle" accessibilityRole="header">
                Lost &amp; Found
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post an item"
              onPress={() => router.push('/posts/new')}
              style={[styles.addButton, { backgroundColor: theme.tint }]}>
              <Ionicons name="add" size={28} color={theme.onTint} />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Search posts"
            placeholder="Search, e.g. black wallet"
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.search,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />
          <View style={styles.chips}>
            {filters.map((filter) => (
              <Chip
                key={filter.label}
                label={filter.label}
                selected={type === filter.type}
                onPress={() => setType(filter.type)}
              />
            ))}
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', gap: Spacing.two },
});
