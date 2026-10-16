import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface FormMessageProps {
  message?: string | null;
  tone?: 'error' | 'info';
}

export function FormMessage({ message, tone = 'error' }: FormMessageProps) {
  const theme = useTheme();
  if (!message) {
    return null;
  }
  const color = tone === 'error' ? theme.danger : theme.success;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { borderColor: color, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" style={{ color }}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
});
