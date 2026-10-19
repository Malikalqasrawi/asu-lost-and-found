import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const COST = 12;

// Compared against when there is no password to check (an unknown email, or an
// account that only signs in with Microsoft), so response times don't reveal
// which accounts exist. Made from random bytes, so no password can match it.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), COST);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(
  password: string,
  hash: string | null | undefined,
): Promise<boolean> {
  const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && matches;
}
