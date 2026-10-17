import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { photoUrl, type Post } from '@/api/posts';
import { AuthImage } from '@/components/auth-image';
import { PostBadges } from '@/components/post-badges';
import { ThemedText } from '@/components/themed-text';
import { categoryLabels, formatDay, typeLabels } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const PostCard = memo(function PostCard({ post }: { post: Post }) {
  const theme = useTheme();
  const router = useRouter();
  const [firstPhoto] = post.photoIds;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${typeLabels[post.type]}: ${post.title}`}
      onPress={() => router.push(`/posts/${post.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {firstPhoto ? (
        <AuthImage
          uri={photoUrl(firstPhoto, post.isMine && post.type === 'FOUND')}
          style={styles.thumbnail}
          accessibilityLabel={`Photo of ${post.title}`}
        />
      ) : (
        <View style={[styles.thumbnail, styles.noPhoto, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
        </View>
      )}
      <View style={styles.text}>
        <PostBadges type={post.type} status={post.status} />
        <ThemedText type="smallBold" numberOfLines={1}>
          {post.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {categoryLabels[post.category]} · {post.place.name} · {formatDay(post.happenedOn)}
        </ThemedText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  pressed: { opacity: 0.7 },
  thumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  noPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.one,
    justifyContent: 'center',
  },
});
