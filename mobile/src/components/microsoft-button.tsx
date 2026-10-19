import { useMutation } from '@tanstack/react-query';

import { authApi } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/button';
import {
  microsoftIdToken,
  type MicrosoftSettings,
  MicrosoftSignInError,
} from '@/session/microsoft';
import { useSession } from '@/session/session-provider';

interface MicrosoftButtonProps {
  settings: MicrosoftSettings;
  onError: (message: string | null) => void;
}

export function MicrosoftButton({ settings, onError }: MicrosoftButtonProps) {
  const { signIn } = useSession();

  const login = useMutation({
    mutationFn: async () => {
      const { nonce } = await authApi.microsoftStart();
      const idToken = await microsoftIdToken(settings, nonce);
      return idToken ? authApi.microsoft(idToken) : null;
    },
    onSuccess: async (auth) => {
      if (auth) {
        await signIn(auth);
      }
    },
    onError: (failure) =>
      onError(
        failure instanceof MicrosoftSignInError
          ? 'Microsoft sign-in failed. Try again.'
          : errorMessage(failure),
      ),
  });

  return (
    <Button
      title="Continue with Microsoft"
      variant="secondary"
      loading={login.isPending}
      onPress={() => {
        onError(null);
        login.mutate();
      }}
    />
  );
}
