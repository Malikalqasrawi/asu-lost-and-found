import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { Message } from '@/api/handovers';
import { ThemedText } from '@/components/themed-text';
import { formatMessageTime } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  const theme = useTheme();
  const { mine } = message;

  return (
    <View
      style={[
        styles.bubble,
        mine
          ? [styles.mine, { backgroundColor: theme.tint }]
          : [styles.theirs, { backgroundColor: theme.backgroundElement }],
      ]}>
      <ThemedText style={mine ? { color: theme.onTint } : undefined}>{message.text}</ThemedText>
      <ThemedText
        type="small"
        style={[styles.time, { color: mine ? theme.onTint : theme.textSecondary }]}>
        {formatMessageTime(message.createdAt)}
      </ThemedText>
    </View>
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
});
