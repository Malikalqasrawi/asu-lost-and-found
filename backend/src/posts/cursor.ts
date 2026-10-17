// "<created at in ms>_<post id>": the next page starts right after this post in
// the sort order, even if the post itself was closed in the meantime.
export const CURSOR = /^(\d{1,15})_([0-9a-f-]{36})$/;

export function toCursor(post: { createdAt: Date; id: string }): string {
  return `${post.createdAt.getTime()}_${post.id}`;
}

/** Expects a cursor that already passed the CURSOR check in the request DTO. */
export function parseCursor(cursor: string): { createdAt: Date; id: string } {
  const [, millis, id] = CURSOR.exec(cursor) ?? [];
  return { createdAt: new Date(Number(millis)), id };
}
