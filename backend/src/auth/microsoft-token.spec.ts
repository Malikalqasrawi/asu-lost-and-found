import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTPayload,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';
import { EnvironmentVariables } from '../config/env.validation.js';
import { MicrosoftTokenVerifier } from './microsoft-token.js';

const CLIENT_ID = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const TENANT_ID = 'f1e2d3c4-b5a6-4978-8695-a4b3c2d1e0f9';
const OTHER_TENANT_ID = 'a9b8c7d6-e5f4-4321-8765-0fedcba98765';
const NONCE = 'nonce-from-the-app-0123456789';
const KEY_ID = 'unit-test-key';

const signing = await generateKeyPair('RS256');
const keys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(signing.publicKey)), kid: KEY_ID, alg: 'RS256' },
  ],
});

function verifier(
  settings: Partial<EnvironmentVariables>,
  keySet: JWTVerifyGetKey = createLocalJWKSet({ keys: [] }),
) {
  const config = {
    get: (key: keyof EnvironmentVariables) => settings[key],
  } as unknown as ConfigService<EnvironmentVariables, true>;
  return new MicrosoftTokenVerifier(config, keySet);
}

const turnedOn = (tenantId = TENANT_ID) =>
  verifier(
    { MICROSOFT_CLIENT_ID: CLIENT_ID, MICROSOFT_TENANT_ID: tenantId },
    keys,
  );

function idToken(
  claims: JWTPayload = {},
  issuerTenant = TENANT_ID,
): Promise<string> {
  return new SignJWT({
    tid: TENANT_ID,
    oid: '6a1f0c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
    preferred_username: '123456789@students.asu.edu.jo',
    name: 'Lina Haddad',
    nonce: NONCE,
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setIssuer(`https://login.microsoftonline.com/${issuerTenant}/v2.0`)
    .setAudience(CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(signing.privateKey);
}

describe('MicrosoftTokenVerifier', () => {
  it('is on only when both the client and the tenant are set', () => {
    expect(verifier({}).enabled).toBe(false);
    expect(verifier({ MICROSOFT_CLIENT_ID: CLIENT_ID }).enabled).toBe(false);
    expect(verifier({ MICROSOFT_TENANT_ID: TENANT_ID }).enabled).toBe(false);
    expect(
      verifier({
        MICROSOFT_CLIENT_ID: CLIENT_ID,
        MICROSOFT_TENANT_ID: TENANT_ID,
      }).enabled,
    ).toBe(true);
  });

  it('refuses every token while it is off', async () => {
    await expect(verifier({}).verify('a.b.c')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('reads the account, the email and a tidy name from the token', async () => {
    const token = await idToken({
      preferred_username: ' 123456789@Students.ASU.edu.jo ',
      name: `  Lina \n  Haddad${' x'.repeat(60)}`,
    });

    const identity = await turnedOn().verify(token);

    expect(identity.microsoftId).toBe(
      `${TENANT_ID}:6a1f0c2e-3b4d-4e5f-8a9b-0c1d2e3f4a5b`,
    );
    expect(identity.email).toBe('123456789@students.asu.edu.jo');
    expect(identity.name).toMatch(/^Lina Haddad x x/);
    expect(identity.name).toHaveLength(80);
    expect(identity.nonce).toBe(NONCE);
  });

  it('accepts a tenant ID written in capitals in the settings', async () => {
    const identity = await turnedOn(TENANT_ID.toUpperCase()).verify(
      await idToken(),
    );

    expect(identity.microsoftId.startsWith(`${TENANT_ID}:`)).toBe(true);
  });

  it('gives an empty email and name when the token has none', async () => {
    const token = await idToken({ preferred_username: 42, name: undefined });

    const identity = await turnedOn().verify(token);

    expect(identity).toMatchObject({ email: '', name: '' });
  });

  it('refuses a token without an object id', async () => {
    const token = await idToken({ oid: undefined });

    await expect(turnedOn().verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses a token issued by another tenant that claims to be ours', async () => {
    const token = await idToken({}, OTHER_TENANT_ID);

    await expect(turnedOn().verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses a token signed with a shared secret instead of the RSA key', async () => {
    const token = await new SignJWT({ tid: TENANT_ID, oid: 'x', nonce: NONCE })
      .setProtectedHeader({ alg: 'HS256', kid: KEY_ID })
      .setIssuer(`https://login.microsoftonline.com/${TENANT_ID}/v2.0`)
      .setAudience(CLIENT_ID)
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-secret-anyone-could-guess-1234'));

    await expect(turnedOn().verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses a token without the one-time value from the server', async () => {
    const token = await idToken({ nonce: undefined });

    await expect(turnedOn().verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses guests whose account belongs to another organisation', async () => {
    const token = await idToken({
      idp: `https://sts.windows.net/${OTHER_TENANT_ID}/`,
    });

    await expect(turnedOn().verify(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
