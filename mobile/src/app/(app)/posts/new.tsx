import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import { useCreatePost, usePlaces, type Category, type PostType } from '@/api/posts';
import { Button } from '@/components/button';
import { ChoiceChips, type Choice } from '@/components/choice-chips';
import { DayPicker } from '@/components/day-picker';
import { FormMessage } from '@/components/form-message';
import { FoundItemDetails, type FoundItemSecrets } from '@/components/found-item-details';
import { PhotoPicker } from '@/components/photo-picker';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { categoryLabels, daysAgo } from '@/constants/labels';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePhotoPicker } from '@/media/use-photo-picker';

const MAX_PHOTOS = 4;

const typeChoices: Choice<PostType>[] = [
  { value: 'LOST', label: 'I lost something' },
  { value: 'FOUND', label: 'I found something' },
];
const categoryChoices = Object.entries(categoryLabels).map(([value, label]) => ({
  value: value as Category,
  label,
}));

const SERIAL_CATEGORIES: (Category | null)[] = ['PHONE', 'LAPTOP', 'ELECTRONICS'];
const noSecrets: FoundItemSecrets = { questions: [''], privateNotes: '', serialNumber: '' };
const descriptionHints: Record<PostType, string> = {
  LOST: 'Anything that helps someone recognise it.',
  FOUND: 'Describe it, but keep the details only the owner would know to yourself.',
};

interface Draft {
  type: PostType | null;
  title: string;
  category: Category | null;
  placeId: string | null;
  questions: string[];
}

const asked = (questions: string[]) => questions.map((question) => question.trim()).filter(Boolean);

function questionsError(draft: Draft): string | undefined {
  if (draft.type !== 'FOUND') {
    return undefined;
  }
  const questions = asked(draft.questions);
  if (questions.length === 0) {
    return 'Add at least one question only the owner can answer.';
  }
  return questions.every((question) => question.length >= 5)
    ? undefined
    : 'Each question needs at least 5 characters.';
}

/** The found-item details to send; a lost item sends none. */
function secretsFor(type: PostType, category: Category, secrets: FoundItemSecrets) {
  if (type !== 'FOUND') {
    return { questions: [], privateNotes: '', serialNumber: '' };
  }
  return {
    questions: asked(secrets.questions),
    privateNotes: secrets.privateNotes.trim(),
    serialNumber: SERIAL_CATEGORIES.includes(category) ? secrets.serialNumber.trim() : '',
  };
}

function validate(draft: Draft) {
  return {
    questions: questionsError(draft),
    type: draft.type ? undefined : 'Choose lost or found.',
    title:
      draft.title.trim().length >= 3 ? undefined : 'Give it a short title, like "Black wallet".',
    category: draft.category ? undefined : 'Choose a category.',
    place: draft.placeId ? undefined : 'Choose where it happened.',
  };
}

const blurHint =
  'Other students see your photos blurred, so only the real owner knows the details.';

interface SectionProps {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function Section({ label, hint, error, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      {children}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

interface PlaceSectionProps {
  value: string | null;
  onChange: (placeId: string) => void;
  error?: string;
}

function PlaceSection({ value, onChange, error }: PlaceSectionProps) {
  const places = usePlaces();
  const choices = (places.data ?? []).map((place) => ({ value: place.id, label: place.name }));
  return (
    <Section label="Where?" error={error}>
      {places.isError ? <FormMessage message={errorMessage(places.error)} /> : null}
      <ChoiceChips choices={choices} selected={value} onSelect={onChange} />
    </Section>
  );
}

/** Values another screen can fill in, like "Post what I found" on a lost post. */
type Prefill = {
  type?: string;
  category?: string;
  placeId?: string;
};

const asType = (value?: string): PostType | null =>
  value === 'LOST' || value === 'FOUND' ? value : null;
const asCategory = (value?: string): Category | null =>
  value && Object.hasOwn(categoryLabels, value) ? (value as Category) : null;

export default function NewPostScreen() {
  const theme = useTheme();
  const router = useRouter();
  const createPost = useCreatePost();
  const photos = usePhotoPicker(MAX_PHOTOS);

  const prefill = useLocalSearchParams<Prefill>();
  const [type, setType] = useState(() => asType(prefill.type));
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(() => asCategory(prefill.category));
  const [placeId, setPlaceId] = useState<string | null>(prefill.placeId ?? null);
  const [placeDetails, setPlaceDetails] = useState('');
  const [happenedOn, setHappenedOn] = useState(() => daysAgo(0));
  const [description, setDescription] = useState('');
  const [secrets, setSecrets] = useState(noSecrets);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = validate({ type, title, category, placeId, questions: secrets.questions });
  const shownErrors: Partial<typeof errors> = submitted ? errors : {};

  function submit() {
    setSubmitted(true);
    setError(null);
    if (!type || !category || !placeId || errors.title || errors.questions) {
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
        ...secretsFor(type, category, secrets),
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
        <ChoiceChips choices={typeChoices} selected={type} onSelect={setType} />
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
        <ChoiceChips choices={categoryChoices} selected={category} onSelect={setCategory} />
      </Section>
      <PlaceSection value={placeId} onChange={setPlaceId} error={shownErrors.place} />
      <TextField
        label="More about the place (optional)"
        placeholder="Second floor, near the printers"
        value={placeDetails}
        onChangeText={setPlaceDetails}
        maxLength={120}
      />
      <Section label="When?">
        <DayPicker value={happenedOn} onChange={setHappenedOn} />
      </Section>
      <TextField
        label="Description (optional)"
        placeholder={descriptionHints[type ?? 'LOST']}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={1000}
        style={styles.multiline}
      />
      {type === 'FOUND' ? (
        <FoundItemDetails
          value={secrets}
          onChange={setSecrets}
          showSerial={SERIAL_CATEGORIES.includes(category)}
          questionsError={shownErrors.questions}
        />
      ) : null}
      <Section
        label={`Photos (up to ${MAX_PHOTOS})`}
        hint={type === 'FOUND' ? blurHint : undefined}>
        <PhotoPicker picker={photos} />
      </Section>
      <Button title="Post" onPress={submit} loading={createPost.isPending} disabled={photos.preparing} />
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
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
