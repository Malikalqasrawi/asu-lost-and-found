import type { MailMessage } from '../mail/mail-sender.js';

// Only the student's own lost title: nothing about the found item leaves the app.

export const possibleMatchEmail = (
  to: string,
  lostTitle: string,
): MailMessage => ({
  to,
  subject: 'A found item may be yours',
  text: [
    'Hi,',
    '',
    `Someone posted a found item that looks like "${lostTitle}", which you reported lost. Have a look, and claim it if it is yours.`,
    '',
    'Open ASU Lost & Found to see the details.',
  ].join('\n'),
});
