import { validateEnv } from './env.validation.js';

const required = {
  DATABASE_URL: 'postgresql://app@localhost:5432/lostfound',
  JWT_SECRET: 'x'.repeat(32),
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
    expect(env.ALLOWED_EMAIL_DOMAINS).toBe('asu.edu.jo');
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
    expect(() => validateEnv({ DATABASE_URL: required.DATABASE_URL })).toThrow(
      /JWT_SECRET/,
    );
    expect(() => validateEnv({ ...required, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    );
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
      ALLOWED_EMAIL_DOMAINS: ' ASU.edu.jo, students.asu.edu.jo ',
    });

    expect(env.ALLOWED_EMAIL_DOMAINS).toBe('asu.edu.jo,students.asu.edu.jo');
  });

  it('rejects a malformed domain list', () => {
    expect(() =>
      validateEnv({ ...required, ALLOWED_EMAIL_DOMAINS: '@asu.edu.jo' }),
    ).toThrow(/ALLOWED_EMAIL_DOMAINS/);
  });

  it('does not include secret values in the error message', () => {
    const secretUrl = 'mysql://user:hunter2@localhost/db';

    expect(() =>
      validateEnv({ ...required, DATABASE_URL: secretUrl, JWT_SECRET: 'abc' }),
    ).not.toThrow(/hunter2|abc/);
  });
});
