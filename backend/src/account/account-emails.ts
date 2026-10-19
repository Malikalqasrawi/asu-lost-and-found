import type { MailMessage } from '../mail/mail-sender.js';

const neverShare =
  'Never share this code. ASU Lost & Found staff will never ask you for it.';

function email(to: string, subject: string, lines: string[]): MailMessage {
  return { to, subject, text: ['Hi,', '', ...lines].join('\n') };
}

export const confirmationCodeEmail = (to: string, code: string) =>
  email(to, 'Your ASU Lost & Found confirmation code', [
    `Your code to confirm a change to your account is ${code}. It works for 15 minutes.`,
    '',
    neverShare,
    "If you didn't ask for it, someone may be using your phone: sign out of the app on devices you don't recognise.",
  ]);

export const newEmailCodeEmail = (to: string, code: string) =>
  email(to, 'Confirm your new email for ASU Lost & Found', [
    `Your code to move your ASU Lost & Found account to this email is ${code}. It works for 15 minutes.`,
    '',
    neverShare,
    "If you didn't ask for this, you can ignore this email.",
  ]);

/** Goes to the old address, so the owner learns about a change they didn't make. */
export const emailChangedEmail = (to: string, newEmail: string) =>
  email(to, 'Your ASU Lost & Found email was changed', [
    `Your account now uses ${newEmail}. You were signed out on your other devices.`,
    '',
    "If you didn't make this change, someone else has your password: tell the university security office.",
  ]);

export const accountDeletedEmail = (to: string) =>
  email(to, 'Your ASU Lost & Found account was deleted', [
    'Your account was deleted. Your name and email were removed, and your open posts and waiting claims were closed.',
    '',
    'You can create a new account with this email at any time.',
  ]);
