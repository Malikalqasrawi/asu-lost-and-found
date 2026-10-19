import { useMutation } from '@tanstack/react-query';

import type { AuthResponse } from '@/api/auth';
import { apiRequest } from '@/api/client';

/** The password, or a code emailed to accounts that sign in with Microsoft only. */
export type IdentityProof = { password: string } | { code: string };

export const accountApi = {
  sendConfirmationCode: () =>
    apiRequest<{ message: string }>('POST', '/users/me/confirmation-code', { auth: true }),

  startEmailChange: (newEmail: string, proof: IdentityProof) =>
    apiRequest<{ message: string }>('POST', '/users/me/email', {
      auth: true,
      body: { newEmail, ...proof },
    }),

  confirmEmailChange: (code: string) =>
    apiRequest<AuthResponse>('POST', '/users/me/email/confirm', { auth: true, body: { code } }),

  deleteAccount: (proof: IdentityProof) =>
    apiRequest<void>('DELETE', '/users/me', { auth: true, body: proof }),
};

export function useSendConfirmationCode() {
  return useMutation({ mutationFn: accountApi.sendConfirmationCode });
}
