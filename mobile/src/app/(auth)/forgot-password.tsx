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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { setPending } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const forgot = useMutation({
    mutationFn: authApi.forgotPassword,
    onSuccess: (_message, sentTo) => {
      setPending({ email: sentTo });
      router.push('/reset-password');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  function submit() {
    setError(null);
    if (!email.trim()) {
      setError('Enter your university email.');
      return;
    }
    forgot.mutate(email.trim());
  }

  return (
    <Screen
      title="Reset your password"
      subtitle="We'll email you a 6-digit code to choose a new password.">
      <FormMessage message={error} />
      <TextField
        label="University email"
        placeholder="123456789@students.asu.edu.jo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={submit}
      />
      <Button title="Send code" onPress={submit} loading={forgot.isPending} />
      <Button title="Back to sign in" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
