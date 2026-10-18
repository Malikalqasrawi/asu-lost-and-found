import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useDismissMatch, useMatches } from '@/api/matches';
import type { Post } from '@/api/posts';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Note } from '@/components/note';
import { PostCard } from '@/components/post-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/** Found items that may be the one the student lost, with why they were suggested. */
export function PossibleMatches({ post }: { post: Post }) {
  const matches = useMatches(post.id);
  const dismiss = useDismissMatch(post.id);

  if (matches.isPending) {
    return null;
  }
  const failure = matches.error ?? dismiss.error;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Possible matches
      </ThemedText>
      <FormMessage message={failure ? errorMessage(failure) : null} />
      {matches.data?.length === 0 ? (
        <Note text="Nothing yet. You get an email when someone posts a found item that looks like yours." />
      ) : null}
      {matches.data?.map((match) => (
        <View key={match.post.id} style={styles.match}>
          <PostCard post={match.post} />
          <View style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.reasons}>
              {match.reasons.join(' · ')}
            </ThemedText>
            <Button
              title="Not mine"
              variant="link"
              disabled={dismiss.isPending}
              onPress={() => dismiss.mutate(match.post.id)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  match: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  reasons: { flex: 1 },
});
