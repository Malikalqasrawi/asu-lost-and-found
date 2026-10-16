import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import { FormMessage } from '@/components/form-message';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { useSession } from '@/session/session-provider';

const RESEND_AFTER_SECONDS = 60;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { pending, signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: signIn,
    onError: (failure) => setError(errorMessage(failure)),
  });

  const resend = useMutation({
    mutationFn: authApi.resendCode,
    onSuccess: () => {
      setSecondsLeft(RESEND_AFTER_SECONDS);
      setNotice('We sent you a new code.');
    },
    onError: (failure) => setError(errorMessage(failure)),
  });

  if (!pending?.password) {
    return (
      <Screen title="Verify your email" subtitle="Sign in again and we'll send you a new code.">
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
    verify.mutate({ email, password, code });
  }

  return (
    <Screen title="Check your email" subtitle={`We sent a 6-digit code to ${email}.`}>
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
      <Button title="Verify email" onPress={submit} loading={verify.isPending} />
      <Button
        title={secondsLeft > 0 ? `Send a new code in ${secondsLeft}s` : 'Send a new code'}
        variant="secondary"
        disabled={secondsLeft > 0}
        loading={resend.isPending}
        onPress={() => {
          setError(null);
          resend.mutate(email);
        }}
      />
    </Screen>
  );
}
