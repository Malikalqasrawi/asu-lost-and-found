import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useClosePost, usePost, type Post } from '@/api/posts';
import { Button } from '@/components/button';
import { ClaimActions } from '@/components/claim-actions';
import { DeskControls } from '@/components/desk-controls';
import { FinderHandover } from '@/components/finder-handover';
import { FormMessage } from '@/components/form-message';
import { PostBadges } from '@/components/post-badges';
import { PostFacts } from '@/components/post-facts';
import { PostPhotos } from '@/components/post-photos';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function PostScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = usePost(id);

  if (post.isPending) {
    return <ThemedView style={styles.flex} />;
  }
  if (post.isError) {
    return (
      <ThemedView style={[styles.flex, styles.content]}>
        <FormMessage message={errorMessage(post.error)} />
      </ThemedView>
    );
  }

  const item = post.data;
  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <PostPhotos post={item} />
      <PostBadges type={item.type} status={item.status} />
      <ThemedText type="subtitle" accessibilityRole="header">
        {item.title}
      </ThemedText>
      <PostFacts post={item} />
      {item.description ? <ThemedText>{item.description}</ThemedText> : null}
      <PostActions post={item} />
    </ScrollView>
  );
}

function PostActions({ post }: { post: Post }) {
  if (post.isMine) {
    return <OwnerActions post={post} />;
  }
  if (post.type === 'FOUND' && post.status !== 'CLOSED') {
    return <ClaimActions post={post} />;
  }
  if (post.status !== 'OPEN') {
    return null;
  }
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
      Found it? Contacting the owner comes in a later update.
    </ThemedText>
  );
}

function OwnerActions({ post }: { post: Post }) {
  const router = useRouter();
  const closePost = useClosePost();
  const found = post.type === 'FOUND';
  const reviewsClaims = found && post.status !== 'CLOSED';
  const accepted = found && (post.status === 'CLAIMED' || post.status === 'RETURNED');

  function confirmClose() {
    Alert.alert('Close this post?', 'It disappears from Browse. You can still see it in My posts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close post', style: 'destructive', onPress: () => closePost.mutate(post.id) },
    ]);
  }

  return (
    <>
      {accepted ? <FinderHandover post={post} /> : null}
      {found ? <DeskControls post={post} /> : null}
      {reviewsClaims ? (
        <Button title="See claims" onPress={() => router.push(`/posts/${post.id}/claims`)} />
      ) : null}
      <FormMessage message={closePost.isError ? errorMessage(closePost.error) : null} />
      {post.status === 'OPEN' && !post.desk ? (
        <Button
          title="Close post"
          variant="secondary"
          loading={closePost.isPending}
          onPress={confirmClose}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  centered: { textAlign: 'center' },
});
