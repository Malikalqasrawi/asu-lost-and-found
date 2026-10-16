import { isAllowedEmail, parseDomains } from './email-domain.js';

describe('isAllowedEmail', () => {
  const domains = ['asu.edu.jo'];

  it('allows an email at a listed domain', () => {
    expect(isAllowedEmail('ahmad@asu.edu.jo', domains)).toBe(true);
  });

  it('ignores the letter case of the domain', () => {
    expect(isAllowedEmail('ahmad@ASU.Edu.Jo', domains)).toBe(true);
  });

  it.each([
    'ahmad@gmail.com',
    'ahmad@evilasu.edu.jo',
    'ahmad@students.asu.edu.jo',
    'ahmad@asu.edu.jo.evil.com',
    'asu.edu.jo',
    '@asu.edu.jo',
  ])('refuses %s', (email) => {
    expect(isAllowedEmail(email, domains)).toBe(false);
  });

  it('allows a subdomain only when it is listed', () => {
    expect(
      isAllowedEmail('ahmad@students.asu.edu.jo', [
        'asu.edu.jo',
        'students.asu.edu.jo',
      ]),
    ).toBe(true);
  });

  it('checks the part after the last @', () => {
    expect(isAllowedEmail('"a@asu.edu.jo"@gmail.com', domains)).toBe(false);
  });
});

describe('parseDomains', () => {
  it('splits, trims and lowercases the list', () => {
    expect(parseDomains(' ASU.edu.jo, students.asu.edu.jo ,')).toEqual([
      'asu.edu.jo',
      'students.asu.edu.jo',
    ]);
  });
});
