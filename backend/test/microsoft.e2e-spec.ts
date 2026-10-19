import { createHash, randomUUID } from 'node:crypto';
import { generateKeyPair } from 'jose';
import type { AuthResponse } from '../src/auth/auth.service.js';
import { createVerifiedUser, PASSWORD, register } from './support/accounts.js';
import { createTestApp, TestContext } from './support/app.js';
import {
  IdTokenClaims,
  microsoftIdToken,
  microsoftNonce,
} from './support/microsoft.js';

describe('Microsoft sign-in', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const studentEmail = () =>
    `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 900 + 100)}@students.asu.edu.jo`;

  async function token(claims: Partial<IdTokenClaims> = {}) {
    return microsoftIdToken({
      oid: randomUUID(),
      email: studentEmail(),
      nonce: claims.nonce ?? (await microsoftNonce(ctx)),
      ...claims,
    });
  }

  const send = (idToken: string) =>
    ctx.http().post('/api/auth/microsoft').send({ idToken });

  async function signIn(claims: Partial<IdTokenClaims> = {}) {
    return send(await token(claims));
  }

  const login = (email: string) =>
    ctx.http().post('/api/auth/login').send({ email, password: PASSWORD });

  it('creates a verified account without a password, and finds it the next time', async () => {
    const email = studentEmail();
    const oid = randomUUID();

    const first = await signIn({ oid, email, name: '  Lina   Haddad ' });
    expect(first.status).toBe(200);
    const { user } = first.body as AuthResponse;
    expect(user).toMatchObject({
      email,
      fullName: 'Lina Haddad',
      role: 'STUDENT',
      hasPassword: false,
    });

    const again = await signIn({ oid, email });
    expect((again.body as AuthResponse).user.id).toBe(user.id);
    await ctx
      .http()
      .post('/api/auth/login')
      .send({ email, password: '' })
      .expect(401);
  });

  it('links an account made with a password and keeps the password', async () => {
    const { email, auth } = await createVerifiedUser(ctx);

    const response = await signIn({ email: email.toUpperCase() });

    expect(response.status).toBe(200);
    expect((response.body as AuthResponse).user).toMatchObject({
      id: auth.user.id,
      hasPassword: true,
    });
    await login(email).expect(200);
    await ctx.outbox.processDue();
    expect(ctx.mailer.sentTo(email).at(-1)?.subject).toBe(
      'Microsoft sign-in was added to your ASU Lost & Found account',
    );
  });

  it('wipes the password of a sign-up that never confirmed its email', async () => {
    const { email } = await register(ctx, studentEmail());

    const response = await signIn({ email });

    expect(response.status).toBe(200);
    expect((response.body as AuthResponse).user).toMatchObject({
      hasPassword: false,
      fullName: 'Lina Haddad',
    });
    await login(email).expect(401);
    const stored = await ctx.prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(stored.emailVerifiedAt).not.toBeNull();
  });

  it('refuses an email that is not a student or staff email', async () => {
    const response = await signIn({ email: 'ahmad@students.asu.edu.jo' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'EMAIL_DOMAIN_NOT_ALLOWED' });
    const created = await ctx.prisma.user.findUnique({
      where: { email: 'ahmad@students.asu.edu.jo' },
    });
    expect(created).toBeNull();
  });

  it('refuses tokens Microsoft did not make for this app and this request', async () => {
    const stranger = await generateKeyPair('RS256');
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600;

    const refused = await Promise.all([
      signIn({ key: stranger.privateKey }),
      signIn({ audience: randomUUID() }),
      signIn({ tid: randomUUID() }),
      signIn({ expiresAt: anHourAgo }),
      signIn({ nonce: 'a-nonce-the-server-never-handed-out' }),
      signIn({
        idp: 'https://sts.windows.net/9188040d-6c67-4c5b-b112-36a304b66dad/',
      }),
    ]);

    expect(refused.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401, 401,
    ]);
    await ctx
      .http()
      .post('/api/auth/microsoft')
      .send({ idToken: 'not-a-token' })
      .expect(400);
  });

  it('blocks a banned student', async () => {
    const oid = randomUUID();
    const email = studentEmail();
    const { user } = (await signIn({ oid, email })).body as AuthResponse;
    await ctx.prisma.user.update({
      where: { id: user.id },
      data: { bannedAt: new Date(), banReason: 'Posting fake items' },
    });

    const response = await signIn({ oid, email });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'ACCOUNT_BANNED' });
  });

  it('refuses a password sign-in to an account made with Microsoft', async () => {
    const email = studentEmail();
    await signIn({ email });

    await ctx
      .http()
      .post('/api/auth/login')
      .send({ email, password: 'not-a-real-password' })
      .expect(401);
  });

  it('gives two first sign-ins at once the same account', async () => {
    const claims = { oid: randomUUID(), email: studentEmail() };

    const [first, second] = await Promise.all([signIn(claims), signIn(claims)]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect((first.body as AuthResponse).user.id).toBe(
      (second.body as AuthResponse).user.id,
    );
  });

  it('names the student when Microsoft sends no name', async () => {
    const response = await signIn({ name: '' });

    expect((response.body as AuthResponse).user.fullName).toBe('ASU student');
  });

  it('will not hand an account to a second Microsoft account with the same email', async () => {
    const email = studentEmail();
    await signIn({ email });

    const response = await signIn({ email });

    expect(response.status).toBe(409);
  });

  it('takes each ID token once, so a copied token cannot sign in again', async () => {
    const idToken = await token();

    await send(idToken).expect(200);
    await send(idToken).expect(401);
  });

  it('refuses a one-time value that has expired', async () => {
    const nonce = await microsoftNonce(ctx);
    await ctx.prisma.signInNonce.updateMany({
      where: { nonceHash: createHash('sha256').update(nonce).digest('hex') },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await signIn({ nonce });

    expect(response.status).toBe(401);
  });
});
