import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import {
  MAX_CLAIMS,
  useClaimForm,
  useWithdrawClaim,
  type ClaimForm,
  type MyClaim,
} from '@/api/claims';
import { errorMessage } from '@/api/errors';
import type { Post } from '@/api/posts';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Note } from '@/components/note';
import { OwnerHandover } from '@/components/owner-handover';
import { Spacing } from '@/constants/theme';

/** Why the student can't claim the item right now, if they can't. */
function blockedReason(post: Post, form: ClaimForm): string | null {
  if (post.status !== 'OPEN') {
    return 'The finder already gave this item to its owner.';
  }
  if (form.attemptsLeft === 0) {
    return `You have used all ${MAX_CLAIMS} claims for this item.`;
  }
  return null;
}

function PendingClaim({ claim }: { claim: MyClaim }) {
  const withdraw = useWithdrawClaim();

  function confirmWithdraw() {
    Alert.alert(
      'Withdraw your claim?',
      `The finder no longer sees it. It counts as one of your ${MAX_CLAIMS} claims for this item.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', style: 'destructive', onPress: () => withdraw.mutate(claim.id) },
      ],
    );
  }

  return (
    <View style={styles.box}>
      <Note text="Your claim is waiting for the finder. You get an email when they decide." />
      <FormMessage message={withdraw.isError ? errorMessage(withdraw.error) : null} />
      <Button
        title="Withdraw my claim"
        variant="secondary"
        loading={withdraw.isPending}
        onPress={confirmWithdraw}
      />
    </View>
  );
}

/** What a student can do with a found item someone else posted. */
export function ClaimActions({ post }: { post: Post }) {
  const router = useRouter();
  const form = useClaimForm(post.id);

  if (form.isPending) {
    return null;
  }
  if (form.isError) {
    return <FormMessage message={errorMessage(form.error)} />;
  }
  const { activeClaim, attemptsLeft } = form.data;
  if (activeClaim?.status === 'PENDING') {
    return <PendingClaim claim={activeClaim} />;
  }
  if (activeClaim?.status === 'ACCEPTED') {
    return <OwnerHandover post={post} />;
  }
  const reason = blockedReason(post, form.data);
  if (reason) {
    return <Note text={reason} />;
  }

  return (
    <View style={styles.box}>
      <Button title="This is mine" onPress={() => router.push(`/posts/${post.id}/claim`)} />
      {attemptsLeft < MAX_CLAIMS ? (
        <Note text={`${attemptsLeft} of ${MAX_CLAIMS} claims left for this item.`} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.two },
});
