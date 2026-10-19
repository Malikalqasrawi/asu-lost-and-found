import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inject } from 'vitest';
import { MICROSOFT_CLIENT_ID, MICROSOFT_TENANT_ID } from './microsoft.js';

process.env.DATABASE_URL = inject('databaseUrl');
process.env.JWT_SECRET = randomBytes(48).toString('base64');
process.env.SERIAL_HASH_KEY = randomBytes(48).toString('base64');
process.env.STUDENT_EMAIL_DOMAIN = 'students.asu.edu.jo';
process.env.STAFF_EMAIL_DOMAINS = 'asu.edu.jo';
process.env.RATE_LIMIT_EMAILS_PER_HOUR = '1000';
process.env.RATE_LIMIT_LOGINS_PER_15_MIN = '1000';
process.env.RATE_LIMIT_UPLOADS_PER_MINUTE = '1000';
process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'lostfound-uploads-'));
process.env.MICROSOFT_CLIENT_ID = MICROSOFT_CLIENT_ID;
process.env.MICROSOFT_TENANT_ID = MICROSOFT_TENANT_ID;
