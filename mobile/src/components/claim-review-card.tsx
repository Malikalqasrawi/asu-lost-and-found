import { StyleSheet, View } from 'react-native';

import type { FinderClaim } from '@/api/claims';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { formatTimestamp, reviewStatusLabels } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ClaimReviewCardProps {
  claim: FinderClaim;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}

function SerialCheck({ matches }: { matches: boolean | null }) {
  if (matches === null) {
    return null;
  }
  return (
    <ThemedText type="smallBold" themeColor={matches ? 'success' : 'danger'}>
      {matches ? 'The serial number matches.' : 'The serial number does not match.'}
    </ThemedText>
  );
}

/** One claim as the finder sees it: the answers to compare with their notes. */
export function ClaimReviewCard({ claim, busy, onAccept, onReject }: ClaimReviewCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.heading}>
        <ThemedText type="smallBold">{claim.claimant.firstName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {reviewStatusLabels[claim.status]} · {formatTimestamp(claim.createdAt)}
        </ThemedText>
      </View>
      {claim.answers.map((item) => (
        <View key={item.question} style={styles.answer}>
          <ThemedText type="small" themeColor="textSecondary">
            {item.question}
          </ThemedText>
          <ThemedText>{item.answer}</ThemedText>
        </View>
      ))}
      {claim.message ? (
        <View style={styles.answer}>
          <ThemedText type="small" themeColor="textSecondary">
            Message
          </ThemedText>
          <ThemedText>{claim.message}</ThemedText>
        </View>
      ) : null}
      <SerialCheck matches={claim.serialMatches} />
      {claim.status === 'PENDING' ? (
        <View style={styles.buttons}>
          <View style={styles.flex}>
            <Button title="Reject" variant="secondary" disabled={busy} onPress={onReject} />
          </View>
          <View style={styles.flex}>
            <Button title="Accept" disabled={busy} onPress={onAccept} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, padding: Spacing.three, borderRadius: 16 },
  heading: { gap: Spacing.half },
  answer: { gap: Spacing.half },
  buttons: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
