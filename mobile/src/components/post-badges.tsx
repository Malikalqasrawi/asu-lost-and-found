import { StyleSheet, View } from 'react-native';

import type { PostStatus, PostType } from '@/api/posts';
import { ThemedText } from '@/components/themed-text';
import { statusLabels, typeLabels } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Found" or "Lost", and the status when the post is no longer open. */
export function PostBadges({ type, status }: { type: PostType; status: PostStatus }) {
  const theme = useTheme();
  const color = type === 'FOUND' ? theme.success : theme.danger;

  return (
    <View style={styles.row}>
      <View style={[styles.badge, { borderColor: color }]}>
        <ThemedText type="smallBold" style={{ color }}>
          {typeLabels[type]}
        </ThemedText>
      </View>
      {status !== 'OPEN' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {statusLabels[status]}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
  },
});
