import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const textColor =
    variant === 'primary' ? theme.onTint : variant === 'link' ? theme.tint : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'link' ? styles.link : styles.button,
        variant === 'primary' && { backgroundColor: theme.tint },
        variant === 'secondary' && { backgroundColor: theme.backgroundElement },
        (pressed || inactive) && styles.dimmed,
      ]}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText type="smallBold" style={[styles.label, { color: textColor }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  link: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
  },
  label: { fontSize: 16 },
  dimmed: { opacity: 0.6 },
});
