import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { EnvironmentVariables } from '../config/env.validation.js';
import { MailMessage, MailSender } from './mail-sender.js';

// Mailpit on this machine speaks plain SMTP. Any other server must upgrade to TLS,
// so nobody on the way can strip it and read the password or the codes.
export const LOCAL_MAIL_HOSTS = ['localhost', '127.0.0.1', 'mailpit'];

export function requiresStartTls(host: string, secure: boolean): boolean {
  return !secure && !LOCAL_MAIL_HOSTS.includes(host.toLowerCase());
}

@Injectable()
export class SmtpMailSender extends MailSender {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    const username = config.get('MAIL_USERNAME', { infer: true });
    const host = config.get('MAIL_HOST', { infer: true });
    const secure = config.get('MAIL_SECURE', { infer: true });
    this.transport = createTransport({
      host,
      port: config.get('MAIL_PORT', { infer: true }),
      secure,
      requireTLS: requiresStartTls(host, secure),
      auth: username
        ? { user: username, pass: config.get('MAIL_PASSWORD', { infer: true }) }
        : undefined,
    });
    this.from = config.get('MAIL_FROM', { infer: true });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
