import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { apiRequest, apiUrl } from '@/api/client';
import type { DeskStatus } from '@/api/desk';

export type PostType = 'LOST' | 'FOUND';
export type PostStatus = 'OPEN' | 'CLAIMED' | 'RETURNED' | 'CLOSED';
export type Category =
  | 'PHONE'
  | 'LAPTOP'
  | 'WALLET'
  | 'KEYS'
  | 'BAG'
  | 'ID_CARD'
  | 'BOOKS'
  | 'CLOTHING'
  | 'ELECTRONICS'
  | 'JEWELRY'
  | 'OTHER';

export interface Place {
  id: string;
  name: string;
}

export interface Post {
  id: string;
  type: PostType;
  status: PostStatus;
  title: string;
  description: string;
  category: Category;
  place: Place;
  placeDetails: string | null;
  happenedOn: string;
  createdAt: string;
  author: { firstName: string };
  isMine: boolean;
  canSeeOriginals: boolean;
  photoIds: string[];
  desk: DeskStatus | null;
  /** A moderator or a ban hid it; only its author still sees it. */
  hidden: boolean;
}

export interface PostPage {
  items: Post[];
  nextCursor: string | null;
}

export interface PickedPhoto {
  uri: string;
}

export interface NewPost {
  type: PostType;
  title: string;
  description: string;
  category: Category;
  placeId: string;
  placeDetails: string;
  happenedOn: string;
  photos: PickedPhoto[];
  /** Found items only. */
  questions: string[];
  privateNotes: string;
  serialNumber: string;
}

export interface PostFilters {
  type?: PostType;
  q?: string;
}

const UPLOAD_TIMEOUT_MS = 60_000;

export function photoUrl(photoId: string, original = false): string {
  return apiUrl(`/photos/${photoId}${original ? '/original' : ''}`);
}

function toFormData(post: NewPost): FormData {
  const form = new FormData();
  const { photos, questions, ...fields } = post;
  for (const [name, value] of Object.entries(fields)) {
    if (value !== '') {
      form.append(name, value);
    }
  }
  for (const question of questions) {
    form.append('questions', question);
  }
  photos.forEach((photo, index) => {
    // React Native uploads a file from this { uri, name, type } shape.
    form.append('photos', {
      uri: photo.uri,
      name: `photo-${index + 1}.jpg`,
      type: 'image/jpeg',
    } as unknown as Blob);
  });
  return form;
}

export const postsApi = {
  places: () => apiRequest<Place[]>('GET', '/places', { auth: true }),

  list: (filters: PostFilters, cursor?: string) => {
    const params = new URLSearchParams();
    if (filters.type) params.set('type', filters.type);
    if (filters.q) params.set('q', filters.q);
    if (cursor) params.set('cursor', cursor);
    const query = params.toString();
    return apiRequest<PostPage>('GET', `/posts${query ? `?${query}` : ''}`, { auth: true });
  },

  mine: () => apiRequest<Post[]>('GET', '/posts/mine', { auth: true }),

  get: (id: string) => apiRequest<Post>('GET', `/posts/${id}`, { auth: true }),

  create: (post: NewPost) =>
    apiRequest<Post>('POST', '/posts', {
      auth: true,
      body: toFormData(post),
      timeoutMs: UPLOAD_TIMEOUT_MS,
    }),

  close: (id: string) => apiRequest<Post>('POST', `/posts/${id}/close`, { auth: true }),
};

export function usePlaces() {
  return useQuery({ queryKey: ['places'], queryFn: postsApi.places, staleTime: Infinity });
}

export function usePosts(filters: PostFilters) {
  return useInfiniteQuery({
    queryKey: ['posts', 'list', filters],
    queryFn: ({ pageParam }) => postsApi.list(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMyPosts() {
  return useQuery({ queryKey: ['posts', 'mine'], queryFn: postsApi.mine });
}

export function usePost(id: string) {
  return useQuery({ queryKey: ['posts', 'detail', id], queryFn: () => postsApi.get(id) });
}

/** The server answers with the saved post, so its screen opens without asking again. */
function usePostMutation<T>(mutationFn: (input: T) => Promise<Post>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (post) => {
      queryClient.setQueryData(['posts', 'detail', post.id], post);
      return queryClient.invalidateQueries({
        queryKey: ['posts'],
        predicate: (query) => query.queryKey[1] !== 'detail' || query.queryKey[2] !== post.id,
      });
    },
  });
}

export function useCreatePost() {
  return usePostMutation(postsApi.create);
}

export function useClosePost() {
  return usePostMutation(postsApi.close);
}
