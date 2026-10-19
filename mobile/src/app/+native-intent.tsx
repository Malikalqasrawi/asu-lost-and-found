import { isMicrosoftRedirect } from '@/session/microsoft';

/** The sign-in screen reads Microsoft's answer itself, so the app stays where it is. */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (isMicrosoftRedirect(path)) {
    return initial ? '/' : null;
  }
  return path;
}
