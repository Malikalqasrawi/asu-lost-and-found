import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { EnvironmentVariables } from '../config/env.validation.js';

/** Microsoft's signing keys; tests put their own keys here. */
export const MICROSOFT_KEYS = Symbol('MICROSOFT_KEYS');

export const microsoftKeysProvider = {
  provide: MICROSOFT_KEYS,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
    const tenant = config.get('MICROSOFT_TENANT_ID', { infer: true });
    return tenant
      ? createRemoteJWKSet(
          new URL(
            `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
          ),
        )
      : null;
  },
};

export interface MicrosoftIdentity {
  /** The tenant and the account's object id, which never change. */
  microsoftId: string;
  email: string;
  name: string;
  /** The one-time value the server handed out for this sign-in. */
  nonce: string;
}

export const microsoftFailed = () =>
  new UnauthorizedException('Microsoft sign-in failed. Try again.');

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

/**
 * Checks an ID token from Microsoft: signed by Microsoft, made for this app,
 * and for a member of the university's own directory.
 */
@Injectable()
export class MicrosoftTokenVerifier {
  private readonly clientId?: string;
  private readonly tenantId?: string;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    @Inject(MICROSOFT_KEYS) private readonly keys: JWTVerifyGetKey | null,
  ) {
    this.clientId = config.get('MICROSOFT_CLIENT_ID', { infer: true });
    this.tenantId = config
      .get('MICROSOFT_TENANT_ID', { infer: true })
      ?.toLowerCase();
  }

  get enabled(): boolean {
    return Boolean(this.clientId && this.tenantId && this.keys);
  }

  async verify(idToken: string): Promise<MicrosoftIdentity> {
    if (!this.keys || !this.clientId || !this.tenantId) {
      throw microsoftFailed();
    }
    const { payload } = await jwtVerify(idToken, this.keys, {
      issuer: `https://login.microsoftonline.com/${this.tenantId}/v2.0`,
      audience: this.clientId,
      algorithms: ['RS256'],
      clockTolerance: 60,
    }).catch(() => {
      throw microsoftFailed();
    });
    return this.identityFrom(payload, this.tenantId);
  }

  /** Guests from other organisations carry the identity provider that signed them in. */
  private identityFrom(
    payload: JWTPayload,
    tenantId: string,
  ): MicrosoftIdentity {
    const fromTenant = text(payload.tid).toLowerCase() === tenantId;
    const guest =
      payload.idp !== undefined &&
      !text(payload.idp).toLowerCase().includes(tenantId);
    const oid = text(payload.oid);
    const nonce = text(payload.nonce);
    if (!fromTenant || guest || !oid || !nonce) {
      throw microsoftFailed();
    }
    return {
      microsoftId: `${tenantId}:${oid}`,
      email: text(payload.preferred_username).toLowerCase(),
      name: text(payload.name).replace(/\s+/g, ' ').slice(0, 80),
      nonce,
    };
  }
}
