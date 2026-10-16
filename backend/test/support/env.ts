import { randomBytes } from 'node:crypto';
import { inject } from 'vitest';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.JWT_SECRET = randomBytes(48).toString('base64');
process.env.ALLOWED_EMAIL_DOMAINS = 'asu.edu.jo';
process.env.RATE_LIMIT_EMAILS_PER_HOUR = '1000';
process.env.RATE_LIMIT_LOGINS_PER_15_MIN = '1000';
