import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useDeskItems } from '@/api/desk';
import { errorMessage } from '@/api/errors';
import { useConfirmReturn } from '@/api/handovers';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Note } from '@/components/note';
import { TextField } from '@/components/text-field';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

/** Whoever has the item types the owner's code to confirm it changed hands. */
export default function PickupScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const atDesk = useDeskItems('AT_DESK', user?.role === 'SECURITY');
  const owner = atDesk.data?.find((item) => item.postId === id)?.owner;
  const confirm = useConfirmReturn(id);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const digits = code.replace(/\s/g, '');
    setError(null);
    if (!/^\d{6}$/.test(digits)) {
      setError('The pickup code has 6 digits.');
      return;
    }
    confirm.mutate(digits, { onError: (failure) => setError(errorMessage(failure)) });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {confirm.isSuccess ? (
        <>
          <FormMessage tone="info" message="Handed over. The item is marked as returned." />
          <Button title="Done" onPress={() => router.back()} />
        </>
      ) : (
        <>
          <Note
            text={
              owner
                ? `Check the student ID first: it should say ${owner.fullName}. Then type the code they show you.`
                : 'Ask the owner for the 6-digit pickup code they see in the app.'
            }
          />
          <FormMessage message={error} />
          <TextField
            label="Pickup code"
            placeholder="123 456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={7}
          />
          <Button title="Confirm handover" onPress={submit} loading={confirm.isPending} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxFormWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
