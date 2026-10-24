import { validateEnv } from './env.validation.js';

const required = {
  DATABASE_URL: 'postgresql://app@localhost:5432/lostfound',
  JWT_SECRET: 'x'.repeat(32),
  SERIAL_HASH_KEY: 's'.repeat(32),
};

describe('validateEnv', () => {
  it('accepts a valid environment and converts numbers', () => {
    const env = validateEnv({ ...required, PORT: '4000', MAIL_PORT: '587' });

    expect(env.DATABASE_URL).toBe(required.DATABASE_URL);
    expect(env.PORT).toBe(4000);
    expect(env.MAIL_PORT).toBe(587);
  });

  it('fills in defaults', () => {
    const env = validateEnv(required);

    expect(env.PORT).toBe(3000);
    expect(env.STUDENT_EMAIL_DOMAIN).toBe('students.asu.edu.jo');
    expect(env.STAFF_EMAIL_DOMAINS).toBe('asu.edu.jo');
    expect(env.MAIL_SECURE).toBe(false);
    expect(env.RATE_LIMIT_EMAILS_PER_HOUR).toBe(10);
  });

  it('rejects a missing database url', () => {
    expect(() => validateEnv({ JWT_SECRET: required.JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a database url that is not postgres', () => {
    expect(() =>
      validateEnv({ ...required, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects a port out of range', () => {
    expect(() => validateEnv({ ...required, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects a missing or short jwt secret', () => {
    expect(() => validateEnv({ ...required, JWT_SECRET: undefined })).toThrow(
      /JWT_SECRET/,
    );
    expect(() => validateEnv({ ...required, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('rejects a missing or short serial hash key', () => {
    expect(() =>
      validateEnv({ ...required, SERIAL_HASH_KEY: undefined }),
    ).toThrow(/SERIAL_HASH_KEY/);
    expect(() =>
      validateEnv({ ...required, SERIAL_HASH_KEY: 'too-short' }),
    ).toThrow(/SERIAL_HASH_KEY/);
  });

  it('reads MAIL_SECURE as a real boolean', () => {
    expect(validateEnv({ ...required, MAIL_SECURE: 'false' }).MAIL_SECURE).toBe(
      false,
    );
    expect(validateEnv({ ...required, MAIL_SECURE: 'true' }).MAIL_SECURE).toBe(
      true,
    );
  });

  it('normalizes the allowed email domains', () => {
    const env = validateEnv({
      ...required,
      STAFF_EMAIL_DOMAINS: ' ASU.edu.jo, alumni.asu.edu.jo ',
    });

    expect(env.STAFF_EMAIL_DOMAINS).toBe('asu.edu.jo,alumni.asu.edu.jo');
  });

  it('rejects a malformed domain list', () => {
    expect(() =>
      validateEnv({ ...required, STAFF_EMAIL_DOMAINS: '@asu.edu.jo' }),
    ).toThrow(/STAFF_EMAIL_DOMAINS/);
    expect(() =>
      validateEnv({ ...required, STUDENT_EMAIL_DOMAIN: 'a,b.com' }),
    ).toThrow(/STUDENT_EMAIL_DOMAIN/);
    expect(
      validateEnv({ ...required, STAFF_EMAIL_DOMAINS: '' }).STAFF_EMAIL_DOMAINS,
    ).toBe('');
  });

  it('does not include secret values in the error message', () => {
    const secretUrl = 'mysql://user:hunter2@localhost/db';

    expect(() =>
      validateEnv({ ...required, DATABASE_URL: secretUrl, JWT_SECRET: 'abc' }),
    ).not.toThrow(/hunter2|abc/);
  });

  it('leaves Microsoft sign-in off when its IDs are empty', () => {
    const env = validateEnv({
      ...required,
      MICROSOFT_CLIENT_ID: '',
      MICROSOFT_TENANT_ID: '',
    });

    expect(env.MICROSOFT_CLIENT_ID).toBeUndefined();
    expect(env.MICROSOFT_TENANT_ID).toBeUndefined();
  });

  it('rejects Microsoft IDs that are not GUIDs', () => {
    expect(() =>
      validateEnv({ ...required, MICROSOFT_TENANT_ID: 'asu.edu.jo' }),
    ).toThrow(/MICROSOFT_TENANT_ID must be the Directory \(tenant\) ID/);
  });

  it('needs HTTPS for an admin website that is not on this machine', () => {
    expect(() =>
      validateEnv({
        ...required,
        ADMIN_SITE_ORIGIN: 'http://admin.example.com',
      }),
    ).toThrow(/ADMIN_SITE_ORIGIN must be an HTTPS origin/);
    expect(
      validateEnv({
        ...required,
        ADMIN_SITE_ORIGIN: 'https://admin.example.com',
      }).ADMIN_SITE_ORIGIN,
    ).toBe('https://admin.example.com');
    expect(
      validateEnv({ ...required, ADMIN_SITE_ORIGIN: 'http://127.0.0.1:4001' })
        .ADMIN_SITE_ORIGIN,
    ).toBe('http://127.0.0.1:4001');
  });
});
