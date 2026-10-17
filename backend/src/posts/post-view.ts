import type {
  Category,
  PostStatus,
  PostType,
  Prisma,
} from '../generated/prisma/client.js';

export const POST_INCLUDE = {
  place: true,
  author: { select: { fullName: true } },
  photos: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.PostInclude;

type PostWithDetails = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

export interface PostView {
  id: string;
  type: PostType;
  status: PostStatus;
  title: string;
  description: string;
  category: Category;
  place: { id: string; name: string };
  placeDetails: string | null;
  happenedOn: string;
  createdAt: Date;
  author: { firstName: string };
  isMine: boolean;
  photoIds: string[];
}

/** Only the first name of the poster is shown; storage keys never leave the server. */
export function toPostView(post: PostWithDetails, viewerId: string): PostView {
  return {
    id: post.id,
    type: post.type,
    status: post.status,
    title: post.title,
    description: post.description,
    category: post.category,
    place: { id: post.place.id, name: post.place.name },
    placeDetails: post.placeDetails,
    happenedOn: post.happenedOn.toISOString().slice(0, 10),
    createdAt: post.createdAt,
    author: { firstName: post.author.fullName.split(' ')[0] },
    isMine: post.authorId === viewerId,
    photoIds: post.photos.map((photo) => photo.id),
  };
}
