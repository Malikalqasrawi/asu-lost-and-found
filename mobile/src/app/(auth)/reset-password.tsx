import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useSession } from '@/session/session-provider';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { pending, setPending } = useSession();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      setPending(null);
      router.replace({ pathname: '/sign-in', params: { reset: '1' } });
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  if (!pending) {
    return (
      <Screen title="Reset your password" subtitle="Start again to get a new code.">
        <Button title="Start again" onPress={() => router.replace('/forgot-password')} />
      </Screen>
    );
  }
  const { email } = pending;

  function submit() {
    setError(null);
    if (code.length !== 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
    reset.mutate({ email, code, newPassword });
  }

  return (
    <Screen
      title="Choose a new password"
      subtitle={`If ${email} has an account, we sent it a 6-digit code.`}>
      <FormMessage message={error} />
      <TextField
        label="Code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      <TextField
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <Button title="Change password" onPress={submit} loading={reset.isPending} />
    </Screen>
  );
}
