import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { FormMessage } from '@/components/form-message';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PhotoPickerState } from '@/media/use-photo-picker';

export function PhotoPicker({ picker }: { picker: PhotoPickerState }) {
  const theme = useTheme();

  return (
    <>
      <FormMessage message={picker.error} />
      <View style={styles.wrap}>
        {picker.photos.map((photo, index) => (
          <View key={photo.uri}>
            <Image
              source={{ uri: photo.uri }}
              style={styles.photo}
              accessibilityLabel={`Photo ${index + 1}`}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => picker.remove(index)}
              style={[styles.remove, { backgroundColor: theme.background }]}>
              <Ionicons name="close" size={16} color={theme.text} />
            </Pressable>
          </View>
        ))}
      </View>
      {picker.preparing ? (
        <ThemedText type="small" themeColor="textSecondary">
          Preparing photos…
        </ThemedText>
      ) : null}
      {picker.photos.length < picker.max && !picker.preparing ? (
        <View style={styles.wrap}>
          <Chip label="Take a photo" selected={false} onPress={() => picker.add('camera')} />
          <Chip label="Choose photos" selected={false} onPress={() => picker.add('library')} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photo: { width: 80, height: 80, borderRadius: 12 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
