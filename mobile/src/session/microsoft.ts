import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export interface MicrosoftSettings {
  clientId: string;
  tenantId: string;
}

/** Microsoft sign-in only shows in builds made with the app registration's IDs. */
export function microsoftSettings(): MicrosoftSettings | null {
  const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
  const tenantId = process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID;
  return clientId && tenantId ? { clientId, tenantId } : null;
}

const REDIRECT_PATH = 'auth';

/** Microsoft's answer comes back to asulostfound://auth (exp://…/--/auth in Expo Go). */
export function isMicrosoftRedirect(path: string): boolean {
  const withoutQuery = path.split(/[?#]/)[0] ?? '';
  return new RegExp(`(^|://|/)${REDIRECT_PATH}/?$`).test(withoutQuery);
}

export class MicrosoftSignInError extends Error {}

/**
 * Opens Microsoft's sign-in page in the browser. The student types the university
 * password there, never in the app; the app only gets back an ID token for the server,
 * carrying the one-time value the server handed out. Null when the student closes the page.
 */
export async function microsoftIdToken(
  { clientId, tenantId }: MicrosoftSettings,
  nonce: string,
): Promise<string | null> {
  const discovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
  };
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'asulostfound', path: REDIRECT_PATH });
  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    extraParams: { nonce, prompt: 'select_account' },
  });

  const result = await request.promptAsync(discovery);
  if (result.type === 'error') {
    throw new MicrosoftSignInError(result.error?.message);
  }
  if (result.type !== 'success' || !request.codeVerifier) {
    return null;
  }
  const tokens = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      redirectUri,
      code: result.params.code,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery,
  ).catch((failure: unknown) => {
    throw new MicrosoftSignInError(String(failure));
  });
  if (!tokens.idToken) {
    throw new MicrosoftSignInError('No ID token');
  }
  return tokens.idToken;
}
