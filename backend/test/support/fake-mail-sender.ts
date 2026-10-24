import { MailMessage, MailSender } from '../../src/mail/mail-sender.js';

export class FakeMailSender extends MailSender {
  readonly sent: MailMessage[] = [];
  failuresLeft = 0;
  /** Runs while an email is being sent, before it succeeds or fails. */
  whileSending?: () => Promise<void>;

  async send(message: MailMessage): Promise<void> {
    await this.whileSending?.();
    if (this.failuresLeft > 0) {
      this.failuresLeft--;
      return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:1025'));
    }
    this.sent.push(message);
    return Promise.resolve();
  }

  sentTo(email: string): MailMessage[] {
    return this.sent.filter((message) => message.to === email);
  }

  /** From the newest email that has a code; others (a match, a notice) can arrive after it. */
  lastCodeFor(email: string): string {
    const codes = this.sentTo(email)
      .map((message) => message.text.match(/\b(\d{6})\b/)?.[1])
      .filter((code) => code !== undefined);
    const code = codes.at(-1);
    if (!code) {
      throw new Error(`No code was emailed to ${email}`);
    }
    return code;
  }
}
