import { ForbiddenException } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

export const ADMIN_COOKIE = 'lf_admin_refresh';
/** Only pages on the admin site can send it: other sites fail the CORS check first. */
export const ADMIN_HEADER = 'X-Lost-Found-Admin';

const COOKIE_PATH = '/api/admin/auth';

function cookieOptions(adminOrigin: string): CookieOptions {
  return {
    httpOnly: true,
    secure: adminOrigin.startsWith('https://'),
    sameSite: 'strict',
    path: COOKIE_PATH,
  };
}

export function setAdminCookie(
  response: Response,
  adminOrigin: string,
  refreshToken: string,
): void {
  // No expiry date, so closing the browser ends the session; the server
  // ends it after 12 hours anyway.
  response.cookie(ADMIN_COOKIE, refreshToken, cookieOptions(adminOrigin));
}

export function clearAdminCookie(
  response: Response,
  adminOrigin: string,
): void {
  response.clearCookie(ADMIN_COOKIE, cookieOptions(adminOrigin));
}

export function readAdminCookie(request: Request): string | null {
  for (const part of request.headers.cookie?.split(';') ?? []) {
    const [name, ...value] = part.trim().split('=');
    if (name === ADMIN_COOKIE && value.length > 0) {
      try {
        return decodeURIComponent(value.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * The cookie goes along with any request to the API, so the endpoints that use
 * it also need the admin site's origin and header, which another site can't
 * fake from a browser.
 */
export function checkFromAdminSite(
  request: Request,
  adminOrigin: string,
): void {
  const header = request.headers[ADMIN_HEADER.toLowerCase()];
  if (request.headers.origin !== adminOrigin || header !== '1') {
    throw new ForbiddenException();
  }
}
