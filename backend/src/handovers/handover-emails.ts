import type { MailMessage } from '../mail/mail-sender.js';

// Like the claim emails, these never include message text or codes.

const closing = 'Open ASU Lost & Found to see the details.';

function email(to: string, subject: string, line: string): MailMessage {
  return { to, subject, text: ['Hi,', '', line, '', closing].join('\n') };
}

export const newMessagesEmail = (to: string, title: string) =>
  email(
    to,
    'New messages about an item',
    `You have new messages about "${title}".`,
  );

export const handedInEmail = (to: string, title: string) =>
  email(
    to,
    'The security office has the item you found',
    `The university security office received "${title}". Thank you for handing it in.`,
  );

export const atDeskEmail = (to: string, title: string) =>
  email(
    to,
    'Your item is at the security office',
    `"${title}" is at the university security office. Bring your student ID and the pickup code from the app.`,
  );

export const pickedUpEmail = (to: string, title: string) =>
  email(
    to,
    'The item you found is back with its owner',
    `The owner of "${title}" picked it up at the security office. Thank you for your help.`,
  );
