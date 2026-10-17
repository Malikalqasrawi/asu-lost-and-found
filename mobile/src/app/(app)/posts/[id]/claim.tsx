import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { MAX_CLAIMS, useClaimForm, useCreateClaim, type ClaimForm } from '@/api/claims';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SERIAL_PATTERN = /^[A-Za-z0-9 -]{4,40}$/;

function serialError(form: ClaimForm, serial: string): string | undefined {
  if (!form.serialRequired || SERIAL_PATTERN.test(serial.trim())) {
    return undefined;
  }
  return 'Enter the serial number or IMEI: 4 to 40 letters, digits, spaces or dashes.';
}

export default function ClaimScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const form = useClaimForm(id);

  if (form.isPending) {
    return <ThemedView style={styles.flex} />;
  }
  if (form.isError) {
    return (
      <ThemedView style={[styles.flex, styles.content]}>
        <FormMessage message={errorMessage(form.error)} />
      </ThemedView>
    );
  }
  return <ClaimFields postId={id} form={form.data} />;
}

function ClaimFields({ postId, form }: { postId: string; form: ClaimForm }) {
  const theme = useTheme();
  const router = useRouter();
  const createClaim = useCreateClaim(postId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [serial, setSerial] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answerOf = (questionId: string) => (answers[questionId] ?? '').trim();
  const missingAnswer = form.questions.some((question) => !answerOf(question.id));
  const serialProblem = serialError(form, serial);

  function submit() {
    setSubmitted(true);
    setError(null);
    if (missingAnswer || serialProblem) {
      return;
    }
    createClaim.mutate(
      {
        answers: form.questions.map((question) => ({
          questionId: question.id,
          answer: answerOf(question.id),
        })),
        message: message.trim(),
        serialNumber: form.serialRequired ? serial.trim() : undefined,
      },
      {
        onSuccess: () => router.back(),
        onError: (failure) => setError(errorMessage(failure)),
      },
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ThemedText type="small" themeColor="textSecondary">
        The finder compares your answers with what they know about the item. You have{' '}
        {form.attemptsLeft} of {MAX_CLAIMS} claims left for it.
      </ThemedText>
      <FormMessage message={error} />
      {form.questions.map((question) => (
        <TextField
          key={question.id}
          label={question.text}
          value={answers[question.id] ?? ''}
          onChangeText={(text) => setAnswers((old) => ({ ...old, [question.id]: text }))}
          error={submitted && !answerOf(question.id) ? 'Answer this question.' : undefined}
          multiline
          maxLength={300}
        />
      ))}
      {form.serialRequired ? (
        <TextField
          label="Serial number or IMEI"
          hint="Settings > About on a phone, or the sticker under a laptop."
          value={serial}
          onChangeText={setSerial}
          error={submitted ? serialProblem : undefined}
          autoCapitalize="characters"
          maxLength={40}
        />
      ) : null}
      <TextField
        label="Message to the finder (optional)"
        placeholder="When and where you lost it"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        style={styles.multiline}
      />
      <Button title="Send claim" onPress={submit} loading={createClaim.isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
