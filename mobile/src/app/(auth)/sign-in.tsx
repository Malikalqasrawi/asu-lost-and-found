import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { authApi } from '@/api/auth';
import { errorMessage, isApiError } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useSession } from '@/session/session-provider';

export default function SignInScreen() {
  const router = useRouter();
  const { reset } = useLocalSearchParams<{ reset?: string }>();
  const { signIn, setPending } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: signIn,
    onError: async (failure, credentials) => {
      if (isApiError(failure, 'EMAIL_NOT_VERIFIED')) {
        setPending(credentials);
        await authApi.resendCode(credentials.email).catch(() => undefined);
        router.push('/verify-email');
        return;
      }
      setError(errorMessage(failure));
    },
  });

  function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    login.mutate({ email: email.trim(), password });
  }

  return (
    <Screen title="Sign in" subtitle="Use your university email to find and return lost items.">
      {reset ? (
        <FormMessage tone="info" message="Your password was changed. Sign in with the new one." />
      ) : null}
      <FormMessage message={error} />
      <TextField
        label="University email"
        placeholder="you@asu.edu.jo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <Button title="Sign in" onPress={submit} loading={login.isPending} />
      <Button
        title="Forgot your password?"
        variant="link"
        onPress={() => router.push('/forgot-password')}
      />
      <Button
        title="New here? Create an account"
        variant="link"
        onPress={() => router.push('/create-account')}
      />
    </Screen>
  );
}
