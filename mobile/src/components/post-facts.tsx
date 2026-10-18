import { StyleSheet, View } from 'react-native';

import type { Post } from '@/api/posts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { categoryLabels, formatDay } from '@/constants/labels';
import { Spacing } from '@/constants/theme';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.value}>
        {value}
      </ThemedText>
    </View>
  );
}

export function PostFacts({ post }: { post: Post }) {
  const where = post.placeDetails ? `${post.place.name}, ${post.placeDetails}` : post.place.name;

  return (
    <ThemedView type="backgroundElement" style={styles.facts}>
      <Fact label="Category" value={categoryLabels[post.category]} />
      <Fact label="Where" value={where} />
      <Fact label={post.type === 'FOUND' ? 'Found on' : 'Lost on'} value={formatDay(post.happenedOn)} />
      <Fact label="Posted by" value={post.isMine ? 'You' : post.author.firstName} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  facts: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  value: { flexShrink: 1, textAlign: 'right' },
});
