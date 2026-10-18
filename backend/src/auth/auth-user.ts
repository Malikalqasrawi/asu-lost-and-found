import type { Role } from '../generated/prisma/client.js';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Signed in on the admin website with the emailed code. */
  adminSession: boolean;
}
