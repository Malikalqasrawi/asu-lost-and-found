import type { PostStatus } from '../generated/prisma/client.js';

/** Closed and hidden posts are only seen by their author. The rest by any student. */
export function canView(
  post: { status: PostStatus; authorId: string; hiddenAt: Date | null },
  viewerId: string,
): boolean {
  return (
    post.authorId === viewerId || (post.status !== 'CLOSED' && !post.hiddenAt)
  );
}
