import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { authApi } from '@/api/auth';
import { errorMessage, isApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useSession } from '@/session/session-provider';

/** Security office accounts: the code emailed after the password. */
export default function SignInCodeScreen() {
  const router = useRouter();
  const { pending, signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: signIn,
    onError: (failure) => {
      // Asking again without a code is how a new one gets sent.
      if (isApiError(failure, 'SIGN_IN_CODE_REQUIRED')) {
        setNotice('We sent you a new code.');
        return;
      }
      setError(errorMessage(failure));
    },
  });

  if (!pending?.password) {
    return (
      <Screen title="Enter your code" subtitle="Sign in again and we'll send you a new code.">
        <Button title="Go to sign in" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }
  const { email, password } = pending;

  function submit() {
    setError(null);
    setNotice(null);
    if (code.length !== 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    login.mutate({ email, password, code });
  }

  return (
    <Screen
      title="Enter your code"
      subtitle={`Security office accounts need a code each time they sign in. We sent it to ${email}.`}>
      <FormMessage message={error} />
      <FormMessage tone="info" message={notice} />
      <TextField
        label="Code"
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={submit}
      />
      <Button title="Sign in" onPress={submit} loading={login.isPending} />
      <Button
        title="Send a new code"
        variant="secondary"
        onPress={() => {
          setError(null);
          setNotice(null);
          login.mutate({ email, password });
        }}
      />
    </Screen>
  );
}
