import type { Prisma } from '../generated/prisma/client.js';

/** Changes to one item wait for each other here, so a claim, a decision and a handover can't cross. */
export function lockPost(tx: Prisma.TransactionClient, postId: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${postId}))`;
}
