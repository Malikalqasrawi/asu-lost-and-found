import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type CryptoKey,
  SignJWT,
} from 'jose';
import type { TestContext } from './app.js';

export const MICROSOFT_CLIENT_ID = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
export const MICROSOFT_TENANT_ID = 'f1e2d3c4-b5a6-4978-8695-a4b3c2d1e0f9';

const KEY_ID = 'test-signing-key';
const signing = await generateKeyPair('RS256');

/** Stands in for Microsoft's published signing keys. */
export const microsoftKeys = createLocalJWKSet({
  keys: [
    { ...(await exportJWK(signing.publicKey)), kid: KEY_ID, alg: 'RS256' },
  ],
});

export interface IdTokenClaims {
  oid: string;
  email: string;
  name?: string;
  nonce?: string;
  /** Set by Microsoft for guests, to the organisation they really belong to. */
  idp?: string;
  tid?: string;
  audience?: string;
  expiresAt?: number;
  key?: CryptoKey;
}

/** An ID token shaped like the ones Microsoft gives the app. */
export function microsoftIdToken(claims: IdTokenClaims): Promise<string> {
  const tid = claims.tid ?? MICROSOFT_TENANT_ID;
  return new SignJWT({
    ver: '2.0',
    tid,
    oid: claims.oid,
    preferred_username: claims.email,
    name: claims.name ?? 'Lina Haddad',
    nonce: claims.nonce,
    idp: claims.idp,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID })
    .setIssuer(`https://login.microsoftonline.com/${tid}/v2.0`)
    .setAudience(claims.audience ?? MICROSOFT_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(claims.expiresAt ?? '1h')
    .sign(claims.key ?? signing.privateKey);
}

/** The one-time value the app asks the API for before it opens Microsoft's page. */
export async function microsoftNonce(ctx: TestContext): Promise<string> {
  const response = await ctx
    .http()
    .post('/api/auth/microsoft/start')
    .expect(200);
  return (response.body as { nonce: string }).nonce;
}
