import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import { photoUrl, type Post } from '@/api/posts';
import { AuthImage } from '@/components/auth-image';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** The post's photos side by side; the poster of a found item sees the originals. */
export function PostPhotos({ post }: { post: Post }) {
  const { width } = useWindowDimensions();
  if (post.photoIds.length === 0) {
    return null;
  }
  const photoWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;
  const showOriginals = post.canSeeOriginals && post.type === 'FOUND';

  return (
    <>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {post.photoIds.map((photoId, index) => (
          <AuthImage
            key={photoId}
            uri={photoUrl(photoId, showOriginals)}
            style={[styles.photo, { width: photoWidth, height: photoWidth * 0.75 }]}
            accessibilityLabel={`Photo ${index + 1} of ${post.title}`}
          />
        ))}
      </ScrollView>
      {showOriginals ? (
        <ThemedText type="small" themeColor="textSecondary">
          {post.isMine
            ? 'You see the original photos. Other students see them blurred.'
            : 'You can see the original photos because the finder accepted your claim.'}
        </ThemedText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  photo: { borderRadius: 16 },
});
