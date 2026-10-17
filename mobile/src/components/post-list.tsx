import type { ReactNode } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api/errors';
import type { Post } from '@/api/posts';
import { FormMessage } from '@/components/form-message';
import { PostCard } from '@/components/post-card';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PostListQuery {
  isPending: boolean;
  isError: boolean;
  isRefetching: boolean;
  error: unknown;
  refetch: () => unknown;
}

interface PostListProps {
  posts: Post[];
  query: PostListQuery;
  header: ReactNode;
  emptyText: string;
  onEndReached?: () => void;
}

const keyOf = (post: Post) => post.id;
const renderPost = ({ item }: { item: Post }) => <PostCard post={item} />;

export function PostList({ posts, query, header, emptyText, onEndReached }: PostListProps) {
  const theme = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: theme.background }]}>
      <FlatList
        data={posts}
        keyExtractor={keyOf}
        renderItem={renderPost}
        contentContainerStyle={styles.list}
        onEndReached={onEndReached}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            {header}
            {query.isError ? <FormMessage message={errorMessage(query.error)} /> : null}
          </View>
        }
        ListEmptyComponent={
          query.isPending || query.isError ? undefined : (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {emptyText}
            </ThemedText>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  empty: { textAlign: 'center', marginTop: Spacing.five },
});
