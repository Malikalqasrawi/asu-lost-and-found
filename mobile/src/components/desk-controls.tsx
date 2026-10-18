import { Alert, StyleSheet, View } from 'react-native';

import { useCancelDesk, useHandIn } from '@/api/desk';
import { errorMessage } from '@/api/errors';
import type { Post } from '@/api/posts';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Note } from '@/components/note';
import { deskSuggested } from '@/constants/labels';
import { Spacing } from '@/constants/theme';

/** The finder's choice to leave the item at the university security office. */
export function DeskControls({ post }: { post: Post }) {
  const handIn = useHandIn();
  const cancel = useCancelDesk();
  const failure = handIn.error ?? cancel.error;

  if (post.status !== 'OPEN' && post.status !== 'CLAIMED') {
    return null;
  }
  if (post.desk === 'AT_DESK') {
    return <Note text="The university security office has this item. The owner picks it up there." />;
  }

  function confirmHandIn() {
    Alert.alert(
      'Hand it to the security office?',
      'Take the item to the university security office. Once they have it, the owner picks it up there.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hand it in', onPress: () => handIn.mutate(post.id) },
      ],
    );
  }

  const suggested = deskSuggested.includes(post.category);
  return (
    <View style={styles.box}>
      <FormMessage message={failure ? errorMessage(failure) : null} />
      {post.desk === 'ON_THE_WAY' ? (
        <>
          <Note text="Take the item to the security office. They confirm here when they have it." />
          <Button
            title="I'll keep it myself"
            variant="secondary"
            loading={cancel.isPending}
            onPress={() => cancel.mutate(post.id)}
          />
        </>
      ) : (
        <>
          {suggested ? (
            <Note text="For valuables, we suggest leaving it at the university security office." />
          ) : null}
          <Button
            title="Hand to security office"
            variant={suggested ? 'primary' : 'secondary'}
            loading={handIn.isPending}
            onPress={confirmHandIn}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
});
