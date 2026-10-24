import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, type ThrottlerModuleOptions } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user.js';
import { MINUTE } from '../common/time.js';
import { EnvironmentVariables } from '../config/env.validation.js';

const SENDS_EMAIL = 'rateLimit:sendsEmail';
const GUESSES_SECRET = 'rateLimit:guessesSecret';
const UPLOADS_PHOTOS = 'rateLimit:uploadsPhotos';

/** Endpoints that can make the server send an email. */
export const SendsEmail = () => SetMetadata(SENDS_EMAIL, true);

/** Endpoints that check a password or a code, so they can be used to guess one. */
export const GuessesSecret = () => SetMetadata(GUESSES_SECRET, true);

/** Endpoints that take photo uploads, which cost the server real work. */
export const UploadsPhotos = () => SetMetadata(UPLOADS_PHOTOS, true);

const reflector = new Reflector();

const lacks = (key: string) => (context: ExecutionContext) =>
  !reflector.get<boolean>(key, context.getHandler());

// One counter per student or network address for all endpoints in the group,
// instead of the default one per endpoint.
const sharedAcrossEndpoints = (
  _context: ExecutionContext,
  tracker: string,
  name: string,
) => `${name}:${tracker}`;

/**
 * Runs after the sign-in check, so requests from a signed-in student are
 * counted per student. Students share one address on campus Wi-Fi, and one of
 * them shouldn't be able to use up everyone's limit.
 */
@Injectable()
export class StudentThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(
    request: Record<string, unknown>,
  ): Promise<string> {
    const user = request.user as AuthUser | undefined;
    return Promise.resolve(
      user ? `student:${user.id}` : `ip:${String(request.ip)}`,
    );
  }
}

/**
 * The account a request is about: the signed-in student, or the email it
 * names before sign-in. Guessing one student's password from many addresses
 * still hits this counter.
 */
function accountTracker(request: Record<string, unknown>): string {
  const user = request.user as AuthUser | undefined;
  if (user) {
    return `student:${user.id}`;
  }
  const body = request.body as { email?: unknown } | undefined;
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  return email ? `email:${email}` : `ip:${String(request.ip)}`;
}

const networkTracker = (request: Record<string, unknown>) =>
  `ip:${String(request.ip)}`;

const signedIn = (context: ExecutionContext) =>
  Boolean(context.switchToHttp().getRequest<{ user?: AuthUser }>().user);

/** A whole network address gets this many times one account's limit, for a campus behind one address. */
const NETWORK_FACTOR = 10;

/** One limit per account, and a looser one per network address before sign-in. */
function accountAndNetwork(
  name: string,
  marker: string,
  ttl: number,
  limit: number,
) {
  return [
    {
      name,
      ttl,
      limit,
      skipIf: lacks(marker),
      getTracker: accountTracker,
      generateKey: sharedAcrossEndpoints,
    },
    {
      name: `${name}-network`,
      ttl,
      limit: limit * NETWORK_FACTOR,
      skipIf: (context: ExecutionContext) =>
        lacks(marker)(context) || signedIn(context),
      getTracker: networkTracker,
      generateKey: sharedAcrossEndpoints,
    },
  ];
}

export function throttlerOptions(
  config: ConfigService<EnvironmentVariables, true>,
): ThrottlerModuleOptions {
  return {
    errorMessage: 'Too many requests. Wait a few minutes and try again.',
    throttlers: [
      { name: 'default', ttl: MINUTE, limit: 120 },
      ...accountAndNetwork(
        'email',
        SENDS_EMAIL,
        60 * MINUTE,
        config.get('RATE_LIMIT_EMAILS_PER_HOUR', { infer: true }),
      ),
      ...accountAndNetwork(
        'secrets',
        GUESSES_SECRET,
        15 * MINUTE,
        config.get('RATE_LIMIT_LOGINS_PER_15_MIN', { infer: true }),
      ),
      {
        name: 'uploads',
        ttl: MINUTE,
        limit: config.get('RATE_LIMIT_UPLOADS_PER_MINUTE', { infer: true }),
        skipIf: lacks(UPLOADS_PHOTOS),
        generateKey: sharedAcrossEndpoints,
      },
    ],
  };
}
