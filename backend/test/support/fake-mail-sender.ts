import { MailMessage, MailSender } from '../../src/mail/mail-sender.js';

export class FakeMailSender extends MailSender {
  readonly sent: MailMessage[] = [];
  failuresLeft = 0;

  send(message: MailMessage): Promise<void> {
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

  lastCodeFor(email: string): string {
    const last = this.sentTo(email).at(-1);
    const code = last?.text.match(/\b(\d{6})\b/)?.[1];
    if (!code) {
      throw new Error(`No code was emailed to ${email}`);
    }
    return code;
  }
}
