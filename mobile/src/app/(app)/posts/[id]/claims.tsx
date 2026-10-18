import { useLocalSearchParams } from 'expo-router';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { MAX_CLAIMS, useDecideClaim, useFinderClaims, type FinderClaim } from '@/api/claims';
import { errorMessage } from '@/api/errors';
import { ClaimReviewCard } from '@/components/claim-review-card';
import { FormMessage } from '@/components/form-message';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const decisions = {
  accept: {
    title: (name: string) => `Accept ${name}'s claim?`,
    message:
      'The item is marked claimed, the other waiting claims are closed and ' +
      'they see your original photos.',
    button: 'Accept',
  },
  reject: {
    title: (name: string) => `Reject ${name}'s claim?`,
    message: `They get an email. Each student gets ${MAX_CLAIMS} claims for an item.`,
    button: 'Reject',
  },
};

function PrivateNotes({ notes, hasSerial }: { notes: string; hasSerial: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.notes, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Your private notes</ThemedText>
      <ThemedText themeColor={notes ? 'text' : 'textSecondary'}>
        {notes || 'You did not add private notes.'}
      </ThemedText>
      {hasSerial ? (
        <ThemedText type="small" themeColor="textSecondary">
          Claimers must give the serial number. You see whether it matches.
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function ClaimsReviewScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const review = useFinderClaims(id);
  const decide = useDecideClaim();

  if (review.isPending) {
    return <ThemedView style={styles.flex} />;
  }
  if (review.isError) {
    return (
      <ThemedView style={[styles.flex, styles.content]}>
        <FormMessage message={errorMessage(review.error)} />
      </ThemedView>
    );
  }

  function confirm(claim: FinderClaim, decision: keyof typeof decisions) {
    const text = decisions[decision];
    Alert.alert(text.title(claim.claimant.firstName), text.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: text.button, onPress: () => decide.mutate({ claimId: claim.id, decision }) },
    ]);
  }

  const { privateNotes, hasSerial, claims } = review.data;
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={review.isRefetching} onRefresh={() => void review.refetch()} />
      }>
      <PrivateNotes notes={privateNotes} hasSerial={hasSerial} />
      <FormMessage message={decide.isError ? errorMessage(decide.error) : null} />
      {claims.length === 0 ? (
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          No claims yet. You get an email when someone claims this item.
        </ThemedText>
      ) : null}
      {claims.map((claim) => (
        <ClaimReviewCard
          key={claim.id}
          claim={claim}
          busy={decide.isPending}
          onAccept={() => confirm(claim, 'accept')}
          onReject={() => confirm(claim, 'reject')}
        />
      ))}
    </ScrollView>
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
  notes: { gap: Spacing.two, padding: Spacing.three, borderRadius: 16 },
  centered: { textAlign: 'center', marginTop: Spacing.three },
});
