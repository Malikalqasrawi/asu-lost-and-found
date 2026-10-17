import { useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { photoUrl, useClosePost, usePost } from '@/api/posts';
import { AuthImage } from '@/components/auth-image';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostBadges } from '@/components/post-badges';
import { categoryLabels, formatDay } from '@/constants/labels';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';


export default function PostScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = usePost(id);
  const closePost = useClosePost();

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
  const photoWidth = Math.min(width, MaxContentWidth) - Spacing.four * 2;

  function confirmClose() {
    Alert.alert('Close this post?', 'It disappears from Browse. You can still see it in My posts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close post', style: 'destructive', onPress: () => closePost.mutate(item.id) },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {item.photoIds.length > 0 ? (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {item.photoIds.map((photoId, index) => (
            <AuthImage
              key={photoId}
              uri={photoUrl(photoId, item.isMine && item.type === 'FOUND')}
              style={[styles.photo, { width: photoWidth, height: photoWidth * 0.75 }]}
              accessibilityLabel={`Photo ${index + 1} of ${item.title}`}
            />
          ))}
        </ScrollView>
      ) : null}
      {item.isMine && item.type === 'FOUND' && item.photoIds.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          You see the original photos. Other students see them blurred.
        </ThemedText>
      ) : null}

      <PostBadges type={item.type} status={item.status} />
      <ThemedText type="subtitle" accessibilityRole="header">
        {item.title}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.facts}>
        <Fact label="Category" value={categoryLabels[item.category]} />
        <Fact
          label="Where"
          value={item.placeDetails ? `${item.place.name}, ${item.placeDetails}` : item.place.name}
        />
        <Fact label={item.type === 'FOUND' ? 'Found on' : 'Lost on'} value={formatDay(item.happenedOn)} />
        <Fact label="Posted by" value={item.isMine ? 'You' : item.author.firstName} />
      </ThemedView>

      {item.description ? <ThemedText>{item.description}</ThemedText> : null}

      <FormMessage message={closePost.isError ? errorMessage(closePost.error) : null} />
      {item.isMine && item.status === 'OPEN' ? (
        <Button
          title="Close post"
          variant="secondary"
          loading={closePost.isPending}
          onPress={confirmClose}
        />
      ) : null}
      {!item.isMine && item.status === 'OPEN' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {item.type === 'FOUND'
            ? 'Is this yours? Claiming an item comes in the next update.'
            : 'Found it? Contacting the owner comes in the next update.'}
        </ThemedText>
      ) : null}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.factValue}>
        {value}
      </ThemedText>
    </View>
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
  photo: { borderRadius: 16 },
  facts: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  factValue: { flexShrink: 1, textAlign: 'right' },
  centered: { textAlign: 'center' },
});
