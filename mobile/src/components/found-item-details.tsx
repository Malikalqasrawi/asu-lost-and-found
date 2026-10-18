import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export const MAX_QUESTIONS = 3;

export interface FoundItemSecrets {
  questions: string[];
  privateNotes: string;
  serialNumber: string;
}

interface FoundItemDetailsProps {
  value: FoundItemSecrets;
  onChange: (value: FoundItemSecrets) => void;
  showSerial: boolean;
  questionsError?: string;
}

/** What only the finder knows: the questions a claimer must answer, and private notes. */
export function FoundItemDetails({ value, onChange, showSerial, questionsError }: FoundItemDetailsProps) {
  const setQuestion = (index: number, text: string) =>
    onChange({ ...value, questions: value.questions.map((old, at) => (at === index ? text : old)) });

  return (
    <View style={styles.box}>
      <View style={styles.intro}>
        <ThemedText type="smallBold">Questions only the owner can answer</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Students who claim this item answer them without seeing your notes. Ask about details
          that aren&apos;t in the photos.
        </ThemedText>
      </View>
      {value.questions.map((question, index) => (
        <TextField
          key={index}
          label={`Question ${index + 1}`}
          placeholder={index === 0 ? 'What is inside it?' : 'Anything else only the owner knows?'}
          value={question}
          onChangeText={(text) => setQuestion(index, text)}
          error={index === 0 ? questionsError : undefined}
          maxLength={200}
        />
      ))}
      {value.questions.length < MAX_QUESTIONS ? (
        <Chip
          label="Add a question"
          selected={false}
          onPress={() => onChange({ ...value, questions: [...value.questions, ''] })}
        />
      ) : null}
      <TextField
        label="Private notes (only you see these)"
        placeholder="What's inside, a scratch, a sticker…"
        value={value.privateNotes}
        onChangeText={(privateNotes) => onChange({ ...value, privateNotes })}
        multiline
        maxLength={1000}
        style={styles.multiline}
      />
      {showSerial ? (
        <TextField
          label="Serial number or IMEI (optional)"
          hint="Only a fingerprint of it is saved. The owner must give the same number."
          value={value.serialNumber}
          onChangeText={(serialNumber) => onChange({ ...value, serialNumber })}
          autoCapitalize="characters"
          maxLength={40}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.three },
  intro: { gap: Spacing.one },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
