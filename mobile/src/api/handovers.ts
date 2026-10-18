import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/api/client';

export type HandoverRole = 'FINDER' | 'OWNER';

export interface Handover {
  postId: string;
  title: string;
  role: HandoverRole;
  otherPerson: { firstName: string };
  pickupCode: string | null;
  codeLocked: boolean;
  returnedAt: string | null;
  unread: number;
}

export interface Message {
  id: string;
  mine: boolean;
  /** Empty when a moderator removed the message. */
  text: string;
  removed: boolean;
  createdAt: string;
}

export interface HandoverSummary {
  postId: string;
  title: string;
  role: HandoverRole;
  otherPerson: { firstName: string };
  lastMessage: Message | null;
  unread: number;
  returnedAt: string | null;
}

/** An open chat checks for new messages this often. */
export const CHAT_REFRESH_MS = 5_000;
const BADGE_REFRESH_MS = 30_000;

export const handoversApi = {
  mine: () => apiRequest<HandoverSummary[]>('GET', '/handovers/mine', { auth: true }),

  view: (postId: string) =>
    apiRequest<Handover>('GET', `/posts/${postId}/handover`, { auth: true }),

  newCode: (postId: string) =>
    apiRequest<Handover>('POST', `/posts/${postId}/handover/new-code`, { auth: true }),

  confirmReturn: (postId: string, code: string) =>
    apiRequest<void>('POST', `/posts/${postId}/handover/return`, {
      auth: true,
      body: { code },
    }),

  messages: (postId: string) =>
    apiRequest<Message[]>('GET', `/posts/${postId}/messages`, { auth: true }),

  send: (postId: string, text: string) =>
    apiRequest<Message>('POST', `/posts/${postId}/messages`, { auth: true, body: { text } }),
};

export function useMyHandovers() {
  return useQuery({
    queryKey: ['handovers', 'mine'],
    queryFn: handoversApi.mine,
    refetchInterval: BADGE_REFRESH_MS,
  });
}

export function useHandover(postId: string, enabled = true) {
  return useQuery({
    queryKey: ['handovers', postId],
    queryFn: () => handoversApi.view(postId),
    enabled,
  });
}

export function useMessages(postId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['messages', postId],
    queryFn: async () => {
      const messages = await handoversApi.messages(postId);
      // Reading the chat marks it read on the server; show that without asking again.
      queryClient.setQueryData<Handover>(['handovers', postId], (old) => old && { ...old, unread: 0 });
      queryClient.setQueryData<HandoverSummary[]>(['handovers', 'mine'], (old) =>
        old?.map((item) => (item.postId === postId ? { ...item, unread: 0 } : item)),
      );
      return messages;
    },
    refetchInterval: CHAT_REFRESH_MS,
  });
}

export function useSendMessage(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => handoversApi.send(postId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', postId] }),
  });
}

/** A new code or a finished handover changes the post and every handover view. */
function useHandoverMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['handovers'] }),
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
        queryClient.invalidateQueries({ queryKey: ['desk'] }),
      ]),
  });
}

export function useNewCode(postId: string) {
  return useHandoverMutation<void>(() => handoversApi.newCode(postId));
}

export function useConfirmReturn(postId: string) {
  return useHandoverMutation((code: string) => handoversApi.confirmReturn(postId, code));
}
