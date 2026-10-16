import { validateEnv } from './env.validation.js';

const databaseUrl = 'postgresql://app@localhost:5432/lostfound';

describe('validateEnv', () => {
  it('accepts a valid environment and converts the port to a number', () => {
    const env = validateEnv({ DATABASE_URL: databaseUrl, PORT: '4000' });

    expect(env.DATABASE_URL).toBe(databaseUrl);
    expect(env.PORT).toBe(4000);
  });

  it('defaults the port to 3000', () => {
    expect(validateEnv({ DATABASE_URL: databaseUrl }).PORT).toBe(3000);
  });

  it('rejects a missing database url', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a database url that is not postgres', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a port out of range', () => {
    expect(() =>
      validateEnv({ DATABASE_URL: databaseUrl, PORT: '70000' }),
    ).toThrow(/PORT/);
  });

  it('does not include the database url in the error message', () => {
    const secretUrl = 'mysql://user:hunter2@localhost/db';

    expect(() => validateEnv({ DATABASE_URL: secretUrl })).not.toThrow(
      /hunter2/,
    );
  });
});
