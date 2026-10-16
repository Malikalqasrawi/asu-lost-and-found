import { StyleSheet, View } from 'react-native';

import { useServerHealth } from '@/api/health';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ServerStatus() {
  const theme = useTheme();
  const { isPending, isError } = useServerHealth();

  let label = 'Server online';
  let color: ThemeColor = 'success';
  if (isPending) {
    label = 'Checking server…';
    color = 'textSecondary';
  } else if (isError) {
    label = 'Server offline';
    color = 'danger';
  }

  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={[styles.dot, { backgroundColor: theme[color] }]} />
      <ThemedText type="small">{label}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
