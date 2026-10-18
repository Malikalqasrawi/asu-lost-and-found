import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { ClaimStatus, MyClaim } from '@/api/claims';
import { ThemedText } from '@/components/themed-text';
import { claimStatusLabels, formatTimestamp } from '@/constants/labels';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const statusColors: Record<ClaimStatus, ThemeColor> = {
  PENDING: 'tint',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'textSecondary',
  CLOSED: 'textSecondary',
};

export const MyClaimCard = memo(function MyClaimCard({ claim }: { claim: MyClaim }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Claim for ${claim.post.title}: ${claimStatusLabels[claim.status]}`}
      onPress={() => router.push(`/posts/${claim.post.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {claim.post.title}
      </ThemedText>
      <ThemedText type="small" themeColor={statusColors[claim.status]}>
        {claimStatusLabels[claim.status]}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Sent {formatTimestamp(claim.createdAt)}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { gap: Spacing.one, padding: Spacing.three, borderRadius: 16 },
  pressed: { opacity: 0.7 },
});
