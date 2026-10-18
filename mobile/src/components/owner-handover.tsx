import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useHandover, useNewCode } from '@/api/handovers';
import type { Post } from '@/api/posts';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { MessagesButton } from '@/components/messages-button';
import { Note } from '@/components/note';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const spaced = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

function whereToPickUp(post: Post, finder: string): string {
  if (post.desk === 'AT_DESK') {
    return 'Pick it up at the university security office. Bring your student ID and show them this code.';
  }
  if (post.desk === 'ON_THE_WAY') {
    return `${finder} is taking it to the security office. You get an email when it is there.`;
  }
  return `Agree with ${finder} where to meet, then show them this code.`;
}

/** The accepted owner's pickup code, and the chat with the finder. */
export function OwnerHandover({ post }: { post: Post }) {
  const theme = useTheme();
  const handover = useHandover(post.id);
  const newCode = useNewCode(post.id);

  if (handover.isPending) {
    return null;
  }
  if (handover.isError) {
    return <FormMessage message={errorMessage(handover.error)} />;
  }
  const { pickupCode, codeLocked, otherPerson, returnedAt } = handover.data;
  if (returnedAt || !pickupCode) {
    return <Note text="You have this item back. Glad it found its way home." />;
  }

  return (
    <View style={styles.box}>
      <View style={[styles.code, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Your pickup code
        </ThemedText>
        <ThemedText type="title" accessibilityLabel={`Pickup code ${pickupCode.split('').join(' ')}`}>
          {spaced(pickupCode)}
        </ThemedText>
      </View>
      <Note text={whereToPickUp(post, otherPerson.firstName)} />
      {codeLocked ? (
        <>
          <Note text="Someone typed a wrong code too many times, so this code is locked." />
          <FormMessage message={newCode.isError ? errorMessage(newCode.error) : null} />
          <Button title="Get a new code" loading={newCode.isPending} onPress={() => newCode.mutate()} />
        </>
      ) : null}
      <MessagesButton handover={handover.data} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
  code: { alignItems: 'center', gap: Spacing.one, padding: Spacing.three, borderRadius: 16 },
});
