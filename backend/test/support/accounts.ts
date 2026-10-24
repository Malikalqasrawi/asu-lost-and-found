import { randomUUID } from 'node:crypto';
import type { AuthResponse } from '../../src/auth/auth.service.js';
import type { TestContext } from './app.js';

export const PASSWORD = 'correct-horse-42';

export function newStudentEmail(): string {
  return `student-${randomUUID().slice(0, 8)}@asu.edu.jo`;
}

export async function register(
  ctx: TestContext,
  email = newStudentEmail(),
  password = PASSWORD,
): Promise<{ email: string; password: string }> {
  await ctx
    .http()
    .post('/api/auth/register')
    .send({ email, password, fullName: 'Ahmad Saleh' })
    .expect(202);
  return { email, password };
}

export async function emailedCode(
  ctx: TestContext,
  email: string,
): Promise<string> {
  await ctx.outbox.processDue();
  return ctx.mailer.lastCodeFor(email);
}

export async function createVerifiedUser(
  ctx: TestContext,
): Promise<{ email: string; password: string; auth: AuthResponse }> {
  const { email, password } = await register(ctx);
  const code = await emailedCode(ctx, email);
  const response = await ctx
    .http()
    .post('/api/auth/verify-email')
    .send({ email, password, code })
    .expect(200);
  return { email, password, auth: response.body as AuthResponse };
}

/** A security office account signs in with the password and then the emailed code. */
export async function signInAsSecurity(
  ctx: TestContext,
  email: string,
  password = PASSWORD,
): Promise<AuthResponse> {
  await ctx
    .http()
    .post('/api/auth/login')
    .send({ email, password })
    .expect(403);
  const code = await emailedCode(ctx, email);
  const response = await ctx
    .http()
    .post('/api/auth/login')
    .send({ email, password, code })
    .expect(200);
  return response.body as AuthResponse;
}
