import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { DeskItem } from '@/api/desk';
import { photoUrl } from '@/api/posts';
import { AuthImage } from '@/components/auth-image';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { categoryLabels, formatDay } from '@/constants/labels';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DeskItemCardProps {
  item: DeskItem;
  busy: boolean;
  onReceive: (item: DeskItem) => void;
}

function ownerLine(item: DeskItem): string {
  if (!item.owner) {
    return 'No claim accepted yet. Keep it until the finder accepts one.';
  }
  return `Goes to ${item.owner.fullName}. Check their student ID.`;
}

/** One item as the security office sees it, with the next step for it. */
export function DeskItemCard({ item, busy, onReceive }: DeskItemCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const [firstPhoto] = item.photoIds;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.row}>
        {firstPhoto ? (
          <AuthImage
            uri={photoUrl(firstPhoto, true)}
            style={styles.thumbnail}
            accessibilityLabel={`Photo of ${item.title}`}
          />
        ) : null}
        <View style={styles.text}>
          <ThemedText type="smallBold">{item.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {categoryLabels[item.category]} · {item.place} · {formatDay(item.happenedOn)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Found by {item.finder.fullName} ({item.finder.email})
          </ThemedText>
        </View>
      </View>
      {item.status === 'AT_DESK' ? <ThemedText type="small">{ownerLine(item)}</ThemedText> : null}
      {item.status === 'ON_THE_WAY' ? (
        <Button title="Received" disabled={busy} onPress={() => onReceive(item)} />
      ) : null}
      {item.status === 'AT_DESK' && item.owner ? (
        <Button title="Hand over" onPress={() => router.push(`/posts/${item.postId}/pickup`)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, padding: Spacing.three, borderRadius: 16 },
  row: { flexDirection: 'row', gap: Spacing.three },
  thumbnail: { width: 72, height: 72, borderRadius: 12 },
  text: { flex: 1, gap: Spacing.one },
});
