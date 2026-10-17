import { useMyPosts } from '@/api/posts';
import { PostList } from '@/components/post-list';
import { ThemedText } from '@/components/themed-text';

export default function MyPostsScreen() {
  const posts = useMyPosts();

  return (
    <PostList
      posts={posts.data ?? []}
      query={posts}
      emptyText="You haven't posted anything yet."
      header={
        <ThemedText type="subtitle" accessibilityRole="header">
          My posts
        </ThemedText>
      }
    />
  );
}
