import type { MailMessage } from '../mail/mail-sender.js';

// No names or other text from the sign-up form: until the email is verified,
// anyone could have typed them.

export function verificationEmail(to: string, code: string): MailMessage {
  return {
    to,
    subject: 'Verify your email for ASU Lost & Found',
    text: [
      'Hi,',
      '',
      `Your ASU Lost & Found verification code is ${code}. It works for 15 minutes.`,
      '',
      'Never share this code. ASU Lost & Found staff will never ask you for it.',
      "If you didn't create an account, you can ignore this email.",
    ].join('\n'),
  };
}

export function passwordResetEmail(to: string, code: string): MailMessage {
  return {
    to,
    subject: 'Reset your ASU Lost & Found password',
    text: [
      'Hi,',
      '',
      `Your ASU Lost & Found password reset code is ${code}. It works for 15 minutes.`,
      '',
      'Never share this code. ASU Lost & Found staff will never ask you for it.',
      "If you didn't ask to reset your password, you can ignore this email. Your password stays the same.",
    ].join('\n'),
  };
}

export function adminSignInEmail(to: string, code: string): MailMessage {
  return {
    to,
    subject: 'Your ASU Lost & Found admin sign-in code',
    text: [
      'Hi,',
      '',
      `Your code for the ASU Lost & Found admin website is ${code}. It works for 15 minutes.`,
      '',
      'Never share this code. If you did not just sign in, change your password: someone else knows it.',
    ].join('\n'),
  };
}

export function securitySignInEmail(to: string, code: string): MailMessage {
  return {
    to,
    subject: 'Your ASU Lost & Found sign-in code',
    text: [
      'Hi,',
      '',
      `Your code to sign in to the security desk is ${code}. It works for 15 minutes.`,
      '',
      'Never share this code. If you did not just sign in, change your password: someone else knows it.',
    ].join('\n'),
  };
}

export function microsoftLinkedEmail(to: string): MailMessage {
  return {
    to,
    subject: 'Microsoft sign-in was added to your ASU Lost & Found account',
    text: [
      'Hi,',
      '',
      'You can now sign in to ASU Lost & Found with your university Microsoft account as well as with your password.',
      '',
      "If this wasn't you, someone has signed in to your university Microsoft account: tell the university IT department.",
    ].join('\n'),
  };
}
