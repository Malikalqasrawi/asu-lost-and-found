import type { Prisma, User } from '../generated/prisma/client.js';

type BanFields = Pick<User, 'bannedAt' | 'bannedUntil'>;

/** Banned right now: a ban with no end date, or one that hasn't ended yet. */
export function isBanned(user: BanFields, now = new Date()): boolean {
  return (
    Boolean(user.bannedAt) && (!user.bannedUntil || user.bannedUntil > now)
  );
}

/** A ban whose end date has passed, still waiting to be lifted. */
export function banHasEnded(user: BanFields, now = new Date()): boolean {
  return Boolean(user.bannedAt) && !isBanned(user, now);
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeZone: 'Asia/Amman',
});

export const formatBanEnd = (until: Date | null) =>
  until ? `until ${dayFormat.format(until)}` : 'for good';

export const bannedMessage = (user: BanFields) =>
  `This account is blocked ${formatBanEnd(user.bannedUntil)}. Check your email for the reason.`;

/** Ends a ban and shows the posts it hid again. */
export async function liftBan(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { bannedAt: null, bannedUntil: null, banReason: null },
  });
  await tx.post.updateMany({
    where: { authorId: userId, hideCause: 'BAN' },
    data: { hiddenAt: null, hideCause: null },
  });
}
