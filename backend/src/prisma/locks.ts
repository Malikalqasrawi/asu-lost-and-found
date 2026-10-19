import type { Prisma } from '../generated/prisma/client.js';

/** Changes to one item wait for each other here, so a claim, a decision and a handover can't cross. */
export function lockPost(tx: Prisma.TransactionClient, postId: string) {
  return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${postId}))`;
}

/** Holds the student's row until the transaction ends; other changes to it wait. */
export function lockUser(tx: Prisma.TransactionClient, userId: string) {
  return tx.$executeRaw`SELECT 1 FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
}
