import type { PostStatus } from '../generated/prisma/client.js';

/** Closed posts are only seen by their author. Open and returned ones by any student. */
export function canView(
  post: { status: PostStatus; authorId: string },
  viewerId: string,
): boolean {
  return post.status !== 'CLOSED' || post.authorId === viewerId;
}
