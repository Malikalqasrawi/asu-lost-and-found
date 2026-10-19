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

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
}

const MIN_PASSWORD_LENGTH = 8;

export default function CreateAccountScreen() {
  const router = useRouter();
  const { setPending } = useSession();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: authApi.register,
    onSuccess: (_message, account) => {
      setPending({ email: account.email, password: account.password });
      router.push('/verify-email');
    },
    onError: (failure) => {
      if (isApiError(failure, 'EMAIL_DOMAIN_NOT_ALLOWED')) {
        setFieldErrors({ email: errorMessage(failure) });
        return;
      }
      setError(errorMessage(failure));
    },
  });

  function submit() {
    setError(null);
    const errors: FieldErrors = {};
    if (fullName.trim().length < 2) {
      errors.fullName = 'Enter your full name.';
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      errors.email = 'Enter your university email.';
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) {
      register.mutate({ fullName: fullName.trim(), email: email.trim(), password });
    }
  }

  return (
    <Screen title="Create an account" subtitle="Only university emails can sign up.">
      <FormMessage message={error} />
      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={fieldErrors.fullName}
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        label="University email"
        placeholder="123456789@students.asu.edu.jo"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      <Button title="Create account" onPress={submit} loading={register.isPending} />
      <Button title="I already have an account" variant="link" onPress={() => router.back()} />
    </Screen>
  );
}
