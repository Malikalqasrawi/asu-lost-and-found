import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

/** A short centred line that explains where things stand. */
export function Note({ text }: { text: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
});
