import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import type { Message } from '@/api/handovers';
import { ThemedText } from '@/components/themed-text';
import { formatMessageTime } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const theme = useTheme();
  const router = useRouter();
  const { mine } = message;
  // Someone else's message can be reported with a long press.
  const reportable = !mine && !message.removed;

  return (
    <Pressable
      disabled={!reportable}
      onLongPress={() => router.push({ pathname: '/report', params: { message: message.id } })}
      accessibilityHint={reportable ? 'Long press to report this message' : undefined}
      style={[
        styles.bubble,
        mine
          ? [styles.mine, { backgroundColor: theme.tint }]
          : [styles.theirs, { backgroundColor: theme.backgroundElement }],
      ]}>
      {message.removed ? (
        <ThemedText type="small" style={[styles.removed, mine ? { color: theme.onTint } : undefined]}>
          A moderator removed this message.
        </ThemedText>
      ) : (
        <ThemedText style={mine ? { color: theme.onTint } : undefined}>{message.text}</ThemedText>
      )}
      <ThemedText
        type="small"
        style={[styles.time, { color: mine ? theme.onTint : theme.textSecondary }]}>
        {formatMessageTime(message.createdAt)}
      </ThemedText>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 16,
    gap: Spacing.half,
  },
  mine: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  time: { opacity: 0.8, alignSelf: 'flex-end' },
  removed: { fontStyle: 'italic' },
});
