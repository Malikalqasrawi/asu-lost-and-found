import bcrypt from 'bcryptjs';

const COST = 12;

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password and response times don't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(
  password: string,
  hash: string | undefined,
): Promise<boolean> {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
