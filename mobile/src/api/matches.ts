import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/api/client';
import type { Post } from '@/api/posts';

export interface Match {
  post: Post;
  /** 0 to 100. */
  score: number;
  reasons: string[];
}

export const matchesApi = {
  forLostPost: (postId: string) =>
    apiRequest<Match[]>('GET', `/posts/${postId}/matches`, { auth: true }),

  dismiss: (postId: string, foundPostId: string) =>
    apiRequest<void>('POST', `/posts/${postId}/matches/${foundPostId}/dismiss`, { auth: true }),
};

export function useMatches(postId: string) {
  return useQuery({
    queryKey: ['matches', postId],
    queryFn: () => matchesApi.forLostPost(postId),
  });
}

export function useDismissMatch(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (foundPostId: string) => matchesApi.dismiss(postId, foundPostId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches', postId] }),
  });
}
