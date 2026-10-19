import { describeRule, isAllowedEmail, parseDomains } from './email-domain.js';

const rule = {
  studentDomain: 'students.asu.edu.jo',
  staffDomains: ['asu.edu.jo'],
};

describe('isAllowedEmail', () => {
  it('accepts a 9-digit student number at the student domain', () => {
    expect(isAllowedEmail('123456789@students.asu.edu.jo', rule)).toBe(true);
    expect(isAllowedEmail('123456789@Students.ASU.edu.jo', rule)).toBe(true);
  });

  it.each([
    'ahmad@students.asu.edu.jo',
    '12345678@students.asu.edu.jo',
    '1234567890@students.asu.edu.jo',
    '12345678a@students.asu.edu.jo',
    ' 123456789@students.asu.edu.jo',
  ])('refuses %s, which is not a student number', (email) => {
    expect(isAllowedEmail(email, rule)).toBe(false);
  });

  it('accepts any address at a staff domain', () => {
    expect(isAllowedEmail('security.desk@asu.edu.jo', rule)).toBe(true);
  });

  it.each([
    'ahmad@gmail.com',
    'ahmad@evilasu.edu.jo',
    '123456789@students.asu.edu.jo.evil.com',
    'asu.edu.jo',
    '@asu.edu.jo',
    '"a@asu.edu.jo"@gmail.com',
  ])('refuses %s', (email) => {
    expect(isAllowedEmail(email, rule)).toBe(false);
  });

  it('allows students only when no staff domain is set', () => {
    const studentsOnly = { ...rule, staffDomains: [] };

    expect(isAllowedEmail('123456789@students.asu.edu.jo', studentsOnly)).toBe(
      true,
    );
    expect(isAllowedEmail('staff@asu.edu.jo', studentsOnly)).toBe(false);
  });
});

describe('describeRule', () => {
  it('explains both kinds of address', () => {
    expect(describeRule(rule)).toBe(
      'Use your student email (your 9-digit student number@students.asu.edu.jo) or a staff email (@asu.edu.jo)',
    );
  });

  it('leaves out staff emails when there are no staff domains', () => {
    expect(describeRule({ ...rule, staffDomains: [] })).toBe(
      'Use your student email (your 9-digit student number@students.asu.edu.jo)',
    );
  });
});

describe('parseDomains', () => {
  it('trims, lowercases and drops empty entries', () => {
    expect(parseDomains(' ASU.edu.jo, alumni.asu.edu.jo ,')).toEqual([
      'asu.edu.jo',
      'alumni.asu.edu.jo',
    ]);
  });
});
