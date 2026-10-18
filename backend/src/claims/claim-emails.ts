import type { MailMessage } from '../mail/mail-sender.js';

// Emails only say that something happened. Answers and private notes stay in
// the app, behind the sign-in check.

const closing = 'Open ASU Lost & Found to see the details.';

export function newClaimEmail(to: string, title: string): MailMessage {
  return {
    to,
    subject: 'Someone says an item you found is theirs',
    text: [
      'Hi,',
      '',
      `A student has claimed "${title}", which you posted as found. Compare their answers with what you know about the item, then accept or reject the claim.`,
      '',
      closing,
    ].join('\n'),
  };
}

export function claimAcceptedEmail(to: string, title: string): MailMessage {
  return {
    to,
    subject: 'Your claim was accepted',
    text: [
      'Hi,',
      '',
      `The finder accepted your claim for "${title}". You can now see the original photos.`,
      '',
      closing,
    ].join('\n'),
  };
}

export function claimRejectedEmail(to: string, title: string): MailMessage {
  return {
    to,
    subject: 'Your claim was not accepted',
    text: [
      'Hi,',
      '',
      `The finder did not accept your claim for "${title}". If it really is yours, you can try again with more details.`,
      '',
      closing,
    ].join('\n'),
  };
}

export function claimClosedEmail(to: string, title: string): MailMessage {
  return {
    to,
    subject: 'An item you claimed went to someone else',
    text: [
      'Hi,',
      '',
      `The finder of "${title}" accepted another student's claim, so your claim is closed.`,
      '',
      closing,
    ].join('\n'),
  };
}

export function postClosedEmail(to: string, title: string): MailMessage {
  return {
    to,
    subject: 'An item you claimed is no longer listed',
    text: [
      'Hi,',
      '',
      `The finder closed the post for "${title}", so your claim is closed.`,
      '',
      closing,
    ].join('\n'),
  };
}
