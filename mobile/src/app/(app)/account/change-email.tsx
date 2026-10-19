import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { accountApi } from '@/api/account';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { IdentityFields, noIdentity, proofFrom } from '@/components/identity-fields';
import { Note } from '@/components/note';
import { TextField } from '@/components/text-field';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

/** Step one: the new address and proof it's you. Step two: the code sent to the new address. */
export default function ChangeEmailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signIn } = useSession();
  const [newEmail, setNewEmail] = useState('');
  const [identity, setIdentity] = useState(noIdentity);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasPassword = user?.hasPassword ?? true;

  async function run(step: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await step();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function start() {
    const proof = proofFrom(hasPassword, identity);
    if (!newEmail.trim() || !proof) {
      setError(
        hasPassword
          ? 'Enter the new email and your password.'
          : 'Enter the new email and the code.',
      );
      return;
    }
    void run(async () => {
      await accountApi.startEmailChange(newEmail.trim().toLowerCase(), proof);
      setCodeSent(true);
    });
  }

  function confirm() {
    void run(async () => {
      await signIn(await accountApi.confirmEmailChange(code.replace(/\s/g, '')));
      router.back();
    });
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <FormMessage message={error} />
      {codeSent ? (
        <>
          <Note
            text={`If ${newEmail.trim()} can be used for an account, a 6-digit code is on its way to it. Your other devices are signed out once you confirm.`}
          />
          <TextField
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={7}
          />
          <Button title="Confirm new email" onPress={confirm} loading={busy} />
        </>
      ) : (
        <>
          <Note
            text={`Now: ${user?.email ?? ''}. Use your student email (your 9-digit student number@students.asu.edu.jo).`}
          />
          <TextField
            label="New email"
            placeholder="123456789@students.asu.edu.jo"
            value={newEmail}
            onChangeText={setNewEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <IdentityFields hasPassword={hasPassword} value={identity} onChange={setIdentity} />
          <Button title="Send code" onPress={start} loading={busy} />
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
