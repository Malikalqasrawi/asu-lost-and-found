import type { MailMessage } from '../mail/mail-sender.js';
import { formatBanEnd } from '../users/bans.js';

function email(to: string, subject: string, lines: string[]): MailMessage {
  return { to, subject, text: ['Hi,', '', ...lines].join('\n') };
}

export const postHiddenEmail = (to: string, title: string) =>
  email(to, 'A moderator hid your post', [
    `A moderator hid "${title}" after students reported it. Other students can no longer see it.`,
  ]);

export const claimRemovedEmail = (to: string, title: string) =>
  email(to, 'An item you claimed is no longer listed', [
    `A moderator removed the post for "${title}", so your claim is closed.`,
  ]);

export const bannedEmail = (to: string, until: Date | null, reason: string) =>
  email(to, 'Your ASU Lost & Found account is blocked', [
    `A moderator blocked your account ${formatBanEnd(until)}. Your open posts are hidden and your waiting claims are closed.`,
    '',
    `Reason: ${reason}`,
  ]);

export const unbannedEmail = (to: string) =>
  email(to, 'Your ASU Lost & Found account works again', [
    'A moderator lifted the block on your account. You can sign in again, and your posts are back.',
  ]);
