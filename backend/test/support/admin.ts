import { UsersService } from '../../src/users/users.service.js';
import { createVerifiedUser, PASSWORD } from './accounts.js';
import type { TestContext } from './app.js';

export const ADMIN_ORIGIN = 'http://localhost:4001';

export interface Admin {
  email: string;
  /** An access token from the admin website's sign-in, with the emailed code. */
  token: string;
  /** The refresh cookie, as a Cookie header value. */
  cookie: string;
  /** A token from the app's normal sign-in, which admin endpoints refuse. */
  appToken: string;
}

export function cookieFrom(setCookie: string[] | string | undefined): string {
  const header = [setCookie ?? []]
    .flat()
    .find((value) => value.startsWith('lf_admin_refresh='));
  if (!header) {
    throw new Error('No admin cookie was set');
  }
  return header.split(';')[0];
}

/** Signs in on the admin website: password, then the code from the email. */
export async function signInAsAdmin(ctx: TestContext): Promise<Admin> {
  const { email, auth } = await createVerifiedUser(ctx);
  await ctx.app.get(UsersService).setRole(email, 'ADMIN');
  const login = await ctx
    .http()
    .post('/api/admin/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  await ctx.outbox.processDue();
  const verified = await ctx
    .http()
    .post('/api/admin/auth/verify')
    .send({
      challenge: login.body.challenge,
      code: ctx.mailer.lastCodeFor(email),
    })
    .expect(200);
  return {
    email,
    token: verified.body.accessToken,
    cookie: cookieFrom(verified.headers['set-cookie']),
    appToken: auth.accessToken,
  };
}
