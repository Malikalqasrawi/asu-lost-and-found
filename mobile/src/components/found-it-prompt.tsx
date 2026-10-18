import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Post } from '@/api/posts';
import { Button } from '@/components/button';
import { Note } from '@/components/note';
import { Spacing } from '@/constants/theme';

/** On someone else's lost post: post the item as found, and the owner sees it as a match. */
export function FoundItPrompt({ post }: { post: Post }) {
  const router = useRouter();

  return (
    <View style={styles.box}>
      <Note text="Found it? Post it as a found item and the owner sees it as a possible match." />
      <Button
        title="Post what I found"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: '/posts/new',
            params: { type: 'FOUND', category: post.category, placeId: post.place.id },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
});
