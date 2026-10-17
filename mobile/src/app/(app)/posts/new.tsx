import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useCreatePost, usePlaces, type Category, type PostType } from '@/api/posts';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { FormMessage } from '@/components/form-message';
import { PhotoPicker } from '@/components/photo-picker';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { categoryLabels, formatDay, localIsoDate } from '@/constants/labels';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePhotoPicker } from '@/media/use-photo-picker';

const MAX_PHOTOS = 4;
const categories = Object.keys(categoryLabels) as Category[];

interface Draft {
  type: PostType | null;
  title: string;
  category: Category | null;
  placeId: string | null;
}

function validate(draft: Draft) {
  return {
    type: draft.type ? undefined : 'Choose lost or found.',
    title:
      draft.title.trim().length >= 3 ? undefined : 'Give it a short title, like "Black wallet".',
    category: draft.category ? undefined : 'Choose a category.',
    place: draft.placeId ? undefined : 'Choose where it happened.',
  };
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localIsoDate(date);
}

function Section({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function NewPostScreen() {
  const theme = useTheme();
  const router = useRouter();
  const places = usePlaces();
  const createPost = useCreatePost();
  const photos = usePhotoPicker(MAX_PHOTOS);
  const today = daysAgo(0);
  const yesterday = daysAgo(1);

  const [type, setType] = useState<PostType | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [placeDetails, setPlaceDetails] = useState('');
  const [happenedOn, setHappenedOn] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validate({ type, title, category, placeId });
  const shownErrors: Partial<typeof errors> = submitted ? errors : {};
  const pickedEarlier = happenedOn !== today && happenedOn !== yesterday;

  function submit() {
    setSubmitted(true);
    setError(null);
    if (!type || !category || !placeId || errors.title) {
      return;
    }

    createPost.mutate(
      {
        type,
        title: title.trim(),
        description: description.trim(),
        category,
        placeId,
        placeDetails: placeDetails.trim(),
        happenedOn,
        photos: photos.photos,
      },
      {
        onSuccess: (post) => router.replace(`/posts/${post.id}`),
        onError: (failure) => setError(errorMessage(failure)),
      },
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <FormMessage message={error} />

      <Section label="What happened?" error={shownErrors.type}>
        <View style={styles.wrap}>
          <Chip label="I lost something" selected={type === 'LOST'} onPress={() => setType('LOST')} />
          <Chip label="I found something" selected={type === 'FOUND'} onPress={() => setType('FOUND')} />
        </View>
      </Section>

      <TextField
        label="Title"
        placeholder="Black leather wallet"
        value={title}
        onChangeText={setTitle}
        error={shownErrors.title}
        maxLength={80}
      />

      <Section label="Category" error={shownErrors.category}>
        <View style={styles.wrap}>
          {categories.map((value) => (
            <Chip
              key={value}
              label={categoryLabels[value]}
              selected={category === value}
              onPress={() => setCategory(value)}
            />
          ))}
        </View>
      </Section>

      <Section label="Where?" error={shownErrors.place}>
        {places.isError ? <FormMessage message={errorMessage(places.error)} /> : null}
        <View style={styles.wrap}>
          {(places.data ?? []).map((place) => (
            <Chip
              key={place.id}
              label={place.name}
              selected={placeId === place.id}
              onPress={() => setPlaceId(place.id)}
            />
          ))}
        </View>
      </Section>
      <TextField
        label="More about the place (optional)"
        placeholder="Second floor, near the printers"
        value={placeDetails}
        onChangeText={setPlaceDetails}
        maxLength={120}
      />

      <Section label="When?">
        <View style={styles.wrap}>
          <Chip label="Today" selected={happenedOn === today} onPress={() => setHappenedOn(today)} />
          <Chip
            label="Yesterday"
            selected={happenedOn === yesterday}
            onPress={() => setHappenedOn(yesterday)}
          />
          <Chip
            label={pickedEarlier ? formatDay(happenedOn) : 'Earlier'}
            selected={pickedEarlier}
            onPress={() => setShowDatePicker(true)}
          />
        </View>
        {showDatePicker ? (
          <DateTimePicker
            value={new Date(`${happenedOn}T12:00:00`)}
            mode="date"
            maximumDate={new Date()}
            onChange={(_event, picked) => {
              setShowDatePicker(false);
              if (picked) {
                setHappenedOn(localIsoDate(picked));
              }
            }}
          />
        ) : null}
      </Section>

      <TextField
        label="Description (optional)"
        placeholder={
          type === 'FOUND'
            ? 'Describe it, but keep the details only the owner would know to yourself.'
            : 'Anything that helps someone recognise it.'
        }
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
        style={styles.multiline}
      />

      <Section label={`Photos (up to ${MAX_PHOTOS})`}>
        {type === 'FOUND' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Other students see your photos blurred, so only the real owner knows the details.
          </ThemedText>
        ) : null}
        <PhotoPicker picker={photos} />
      </Section>

      <Button
        title="Post"
        onPress={submit}
        loading={createPost.isPending}
        disabled={photos.preparing}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
