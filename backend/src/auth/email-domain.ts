import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation.js';

/** Student emails are the 9-digit student number, like 123456789@students.asu.edu.jo. */
export const STUDENT_NUMBER = /^\d{9}$/;

export interface EmailRuleSettings {
  studentDomain: string;
  staffDomains: string[];
}

export function parseDomains(list: string): string[] {
  return list
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/** A student number at the student domain, or any address at a staff domain. */
export function isAllowedEmail(
  email: string,
  { studentDomain, staffDomains }: EmailRuleSettings,
): boolean {
  const at = email.lastIndexOf('@');
  if (at < 1) {
    return false;
  }
  const domain = email.slice(at + 1).toLowerCase();
  if (domain === studentDomain) {
    return STUDENT_NUMBER.test(email.slice(0, at));
  }
  return staffDomains.includes(domain);
}

export function describeRule({
  studentDomain,
  staffDomains,
}: EmailRuleSettings): string {
  const staff = staffDomains.map((domain) => `@${domain}`).join(' or ');
  return `Use your student email (your 9-digit student number@${studentDomain})${
    staff ? ` or a staff email (${staff})` : ''
  }`;
}

/** Who may have an account; sign-up, email changes and Microsoft sign-in all ask it. */
@Injectable()
export class EmailRule {
  private readonly settings: EmailRuleSettings;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.settings = {
      studentDomain: config.get('STUDENT_EMAIL_DOMAIN', { infer: true }),
      staffDomains: parseDomains(
        config.get('STAFF_EMAIL_DOMAINS', { infer: true }),
      ),
    };
  }

  allows(email: string): boolean {
    return isAllowedEmail(email, this.settings);
  }

  check(email: string): void {
    if (!this.allows(email)) {
      throw new BadRequestException({
        message: describeRule(this.settings),
        code: 'EMAIL_DOMAIN_NOT_ALLOWED',
      });
    }
  }
}
