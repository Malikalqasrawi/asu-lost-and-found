import { NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';

export const MAX_WRONG_CODES = 5;

export const HANDOVER_INCLUDE = {
  post: {
    select: {
      title: true,
      status: true,
      deskItem: { select: { status: true } },
    },
  },
  finder: { select: { fullName: true, email: true } },
  owner: { select: { fullName: true, email: true } },
} as const satisfies Prisma.HandoverInclude;

export type HandoverWithPeople = Prisma.HandoverGetPayload<{
  include: typeof HANDOVER_INCLUDE;
}>;

export type HandoverRole = 'FINDER' | 'OWNER';

export const newPickupCode = () =>
  randomInt(0, 1_000_000).toString().padStart(6, '0');

export const firstName = (fullName: string) => fullName.split(' ')[0];

export function roleOf(
  handover: { finderId: string; ownerId: string },
  viewerId: string,
): HandoverRole | null {
  if (handover.finderId === viewerId) {
    return 'FINDER';
  }
  return handover.ownerId === viewerId ? 'OWNER' : null;
}

/** Accepting a claim starts its handover, in the same transaction. */
export function startHandover(
  tx: Prisma.TransactionClient,
  claim: { id: string; postId: string; claimantId: string },
  finderId: string,
) {
  return tx.handover.create({
    data: {
      claimId: claim.id,
      postId: claim.postId,
      finderId,
      ownerId: claim.claimantId,
      pickupCode: newPickupCode(),
    },
  });
}

/** Only the finder and the owner can see a handover; anyone else gets 404. */
export async function handoverFor(
  db: Prisma.TransactionClient,
  postId: string,
  viewerId: string,
): Promise<{ handover: HandoverWithPeople; role: HandoverRole }> {
  const handover = await db.handover.findUnique({
    where: { postId },
    include: HANDOVER_INCLUDE,
  });
  const role = handover && roleOf(handover, viewerId);
  if (!handover || !role) {
    throw new NotFoundException('This handover does not exist.');
  }
  return { handover, role };
}

export function unreadCount(
  db: Prisma.TransactionClient,
  handover: HandoverWithPeople,
  role: HandoverRole,
): Promise<number> {
  return db.message.count({
    where: {
      handoverId: handover.claimId,
      senderId: role === 'FINDER' ? handover.ownerId : handover.finderId,
      createdAt: {
        gt: role === 'FINDER' ? handover.finderReadAt : handover.ownerReadAt,
      },
    },
  });
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

export interface ChatPreview {
  lastMessage: ChatMessage | null;
  unread: number;
}

interface PreviewRow {
  handover_id: string;
  id: string | null;
  sender_id: string | null;
  text: string | null;
  created_at: Date | null;
  unread: number;
}

/** The last message and the unread count of each chat, in one query. */
export async function chatPreviews(
  db: Prisma.TransactionClient,
  handoverIds: string[],
  viewerId: string,
): Promise<Map<string, ChatPreview>> {
  if (handoverIds.length === 0) {
    return new Map();
  }
  const rows = await db.$queryRaw<PreviewRow[]>`
    SELECT h.claim_id AS handover_id, m.id, m.sender_id, m.text, m.created_at,
      (SELECT count(*)::int FROM messages u
        WHERE u.handover_id = h.claim_id
          AND u.sender_id <> ${viewerId}::uuid
          AND u.created_at > CASE WHEN h.finder_id = ${viewerId}::uuid
            THEN h.finder_read_at ELSE h.owner_read_at END) AS unread
    FROM handovers h
    LEFT JOIN LATERAL (
      SELECT id, sender_id, text, created_at FROM messages
      WHERE handover_id = h.claim_id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) m ON true
    WHERE h.claim_id = ANY(${handoverIds}::uuid[])`;
  return new Map(
    rows.map((row) => [
      row.handover_id,
      {
        unread: row.unread,
        lastMessage:
          row.id && row.sender_id && row.text !== null && row.created_at
            ? {
                id: row.id,
                senderId: row.sender_id,
                text: row.text,
                createdAt: row.created_at,
              }
            : null,
      },
    ]),
  );
}
