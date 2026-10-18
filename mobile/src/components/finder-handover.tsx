import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useHandover } from '@/api/handovers';
import type { Post } from '@/api/posts';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { MessagesButton } from '@/components/messages-button';
import { Note } from '@/components/note';
import { Spacing } from '@/constants/theme';

/** After the finder accepts a claim: talk to the owner and confirm the handover. */
export function FinderHandover({ post }: { post: Post }) {
  const router = useRouter();
  const handover = useHandover(post.id);

  if (handover.isPending) {
    return null;
  }
  if (handover.isError) {
    return <FormMessage message={errorMessage(handover.error)} />;
  }
  const { otherPerson, returnedAt } = handover.data;
  if (returnedAt) {
    return <Note text={`You handed this item back to ${otherPerson.firstName}. Thank you!`} />;
  }

  return (
    <View style={styles.box}>
      <Note
        text={`You accepted ${otherPerson.firstName}'s claim. Agree on where to meet, then ask for their pickup code.`}
      />
      <MessagesButton handover={handover.data} />
      {post.desk !== 'AT_DESK' ? (
        <Button
          title="Enter pickup code"
          onPress={() => router.push(`/posts/${post.id}/pickup`)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
});
