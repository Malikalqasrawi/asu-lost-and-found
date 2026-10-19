import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { accountApi } from '@/api/account';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { IdentityFields, noIdentity, proofFrom } from '@/components/identity-fields';
import { ThemedText } from '@/components/themed-text';
import { MaxFormWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/session/session-provider';

const whatHappens = [
  'Your name, email and password are erased, and you are signed out everywhere.',
  'Your open posts are closed, and students waiting on them are told.',
  'Your waiting claims are withdrawn.',
  'Past claims and reports stay, without your name, so claim limits stay fair.',
  'You can make a new account with your email later.',
];

export default function DeleteAccountScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();
  const [identity, setIdentity] = useState(noIdentity);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasPassword = user?.hasPassword ?? true;

  async function remove() {
    const proof = proofFrom(hasPassword, identity);
    if (!proof) {
      setError(hasPassword ? 'Enter your password.' : 'Enter the code from the email.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await accountApi.deleteAccount(proof);
      await signOut();
    } catch (failure) {
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete your account?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.list}>
        <ThemedText type="smallBold">What happens</ThemedText>
        {whatHappens.map((line) => (
          <ThemedText key={line} type="small" themeColor="textSecondary">
            • {line}
          </ThemedText>
        ))}
      </View>
      <IdentityFields hasPassword={hasPassword} value={identity} onChange={setIdentity} />
      <FormMessage message={error} />
      <Button title="Delete my account" onPress={confirmDelete} loading={busy} />
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
  list: { gap: Spacing.two },
});
