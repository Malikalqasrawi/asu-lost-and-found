import { ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { EnvironmentVariables } from '../config/env.validation.js';

const SENDS_EMAIL = 'rateLimit:sendsEmail';
const GUESSES_SECRET = 'rateLimit:guessesSecret';

/** Endpoints that can make the server send an email. */
export const SendsEmail = () => SetMetadata(SENDS_EMAIL, true);

/** Endpoints that check a password or a code, so they can be used to guess one. */
export const GuessesSecret = () => SetMetadata(GUESSES_SECRET, true);

const MINUTE = 60_000;
const reflector = new Reflector();

const lacks = (key: string) => (context: ExecutionContext) =>
  !reflector.get<boolean>(key, context.getHandler());

// One counter per network address for all endpoints in the group, instead of
// the default one per endpoint.
const sharedAcrossEndpoints = (
  _context: ExecutionContext,
  tracker: string,
  name: string,
) => `${name}:${tracker}`;

export function throttlerOptions(
  config: ConfigService<EnvironmentVariables, true>,
): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'default', ttl: MINUTE, limit: 120 },
      {
        name: 'email',
        ttl: 60 * MINUTE,
        limit: config.get('RATE_LIMIT_EMAILS_PER_HOUR', { infer: true }),
        skipIf: lacks(SENDS_EMAIL),
        generateKey: sharedAcrossEndpoints,
      },
      {
        name: 'secrets',
        ttl: 15 * MINUTE,
        limit: config.get('RATE_LIMIT_LOGINS_PER_15_MIN', { infer: true }),
        skipIf: lacks(GUESSES_SECRET),
        generateKey: sharedAcrossEndpoints,
      },
    ],
  };
}
