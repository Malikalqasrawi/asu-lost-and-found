import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/api/client';
import type { Category } from '@/api/posts';

export type DeskStatus = 'ON_THE_WAY' | 'AT_DESK' | 'PICKED_UP';
/** The two lists the security desk works from. */
export type DeskQueue = Exclude<DeskStatus, 'PICKED_UP'>;

export interface DeskItem {
  postId: string;
  status: DeskStatus;
  title: string;
  category: Category;
  place: string;
  happenedOn: string;
  photoIds: string[];
  finder: { fullName: string; email: string };
  owner: { fullName: string } | null;
  handedInAt: string;
  receivedAt: string | null;
}

export const deskApi = {
  handIn: (postId: string) =>
    apiRequest<void>('POST', `/posts/${postId}/desk`, { auth: true }),

  cancel: (postId: string) =>
    apiRequest<void>('DELETE', `/posts/${postId}/desk`, { auth: true }),

  items: (status: DeskQueue) =>
    apiRequest<DeskItem[]>('GET', `/desk/items?status=${status}`, { auth: true }),

  receive: (postId: string) =>
    apiRequest<DeskItem>('POST', `/desk/items/${postId}/receive`, { auth: true }),
};

export function useDeskItems(status: DeskQueue, enabled = true) {
  return useQuery({
    queryKey: ['desk', status],
    queryFn: () => deskApi.items(status),
    enabled,
  });
}

function useDeskMutation(mutationFn: (postId: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['desk'] }),
        queryClient.invalidateQueries({ queryKey: ['posts'] }),
      ]),
  });
}

export function useHandIn() {
  return useDeskMutation(deskApi.handIn);
}

export function useCancelDesk() {
  return useDeskMutation(deskApi.cancel);
}

export function useReceiveItem() {
  return useDeskMutation(deskApi.receive);
}
