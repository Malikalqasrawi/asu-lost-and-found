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
