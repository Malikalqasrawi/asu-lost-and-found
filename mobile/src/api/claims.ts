import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/api/client';
import type { PostType } from '@/api/posts';

/** Claims a student gets per item, counting rejected and withdrawn ones; the server enforces it. */
export const MAX_CLAIMS = 3;

export type ClaimStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'CLOSED';

interface Answer {
  question: string;
  answer: string;
}

export interface MyClaim {
  id: string;
  status: ClaimStatus;
  post: { id: string; title: string; type: PostType };
  message: string;
  answers: Answer[];
  createdAt: string;
  decidedAt: string | null;
}

export interface FinderClaim {
  id: string;
  status: ClaimStatus;
  claimant: { firstName: string };
  message: string;
  answers: Answer[];
  serialMatches: boolean | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface ClaimForm {
  questions: { id: string; text: string }[];
  serialRequired: boolean;
  attemptsLeft: number;
  activeClaim: MyClaim | null;
}

export interface FinderClaims {
  privateNotes: string;
  questions: string[];
  hasSerial: boolean;
  claims: FinderClaim[];
}

export interface NewClaim {
  answers: { questionId: string; answer: string }[];
  message: string;
  serialNumber?: string;
}

export const claimsApi = {
  form: (postId: string) =>
    apiRequest<ClaimForm>('GET', `/posts/${postId}/claim-form`, { auth: true }),

  create: (postId: string, claim: NewClaim) =>
    apiRequest<MyClaim>('POST', `/posts/${postId}/claims`, { auth: true, body: claim }),

  forFinder: (postId: string) =>
    apiRequest<FinderClaims>('GET', `/posts/${postId}/claims`, { auth: true }),

  mine: () => apiRequest<MyClaim[]>('GET', '/claims/mine', { auth: true }),

  decide: (claimId: string, decision: 'accept' | 'reject') =>
    apiRequest<FinderClaim>('POST', `/claims/${claimId}/${decision}`, { auth: true }),

  withdraw: (claimId: string) =>
    apiRequest<MyClaim>('POST', `/claims/${claimId}/withdraw`, { auth: true }),
};

export function useClaimForm(postId: string, enabled = true) {
  return useQuery({
    queryKey: ['claims', 'form', postId],
    queryFn: () => claimsApi.form(postId),
    enabled,
  });
}

export function useFinderClaims(postId: string, enabled = true) {
  return useQuery({
    queryKey: ['claims', 'finder', postId],
    queryFn: () => claimsApi.forFinder(postId),
    enabled,
  });
}

export function useMyClaims() {
  return useQuery({ queryKey: ['claims', 'mine'], queryFn: claimsApi.mine });
}

/** Claims change posts too (an accepted claim marks the item claimed). */
function useClaimMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['claims'] }),
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
      ]),
  });
}

export function useCreateClaim(postId: string) {
  return useClaimMutation((claim: NewClaim) => claimsApi.create(postId, claim));
}

export function useDecideClaim() {
  return useClaimMutation(
    ({ claimId, decision }: { claimId: string; decision: 'accept' | 'reject' }) =>
      claimsApi.decide(claimId, decision),
  );
}

export function useWithdrawClaim() {
  return useClaimMutation(claimsApi.withdraw);
}
