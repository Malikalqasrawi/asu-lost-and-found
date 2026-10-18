import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { HandoverSummary } from '@/api/handovers';
import { ThemedText } from '@/components/themed-text';
import { formatMessageTime } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function preview(handover: HandoverSummary): string {
  if (handover.returnedAt) {
    return 'Handed over';
  }
  const last = handover.lastMessage;
  if (!last) {
    return 'No messages yet';
  }
  const text = last.removed ? 'Message removed' : last.text;
  return last.mine ? `You: ${text}` : text;
}

export const HandoverCard = memo(function HandoverCard({ handover }: { handover: HandoverSummary }) {
  const theme = useTheme();
  const router = useRouter();
  const { firstName } = handover.otherPerson;
  const unread = handover.unread > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${handover.title}, with ${firstName}${unread ? `, ${handover.unread} new` : ''}`}
      onPress={() => router.push(`/posts/${handover.postId}/chat`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {handover.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {handover.role === 'FINDER' ? `You found it · ${firstName}'s item` : `Found by ${firstName}`}
          {handover.lastMessage ? ` · ${formatMessageTime(handover.lastMessage.createdAt)}` : ''}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} themeColor={unread ? 'text' : 'textSecondary'}>
          {preview(handover)}
        </ThemedText>
      </View>
      {unread ? (
        <View style={[styles.badge, { backgroundColor: theme.tint }]}>
          <ThemedText type="smallBold" style={{ color: theme.onTint }}>
            {handover.unread}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: Spacing.half },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
