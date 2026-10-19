import { apiRequest } from '@/api/client';
import type { Tokens } from '@/session/tokens';

export type Role = 'STUDENT' | 'SECURITY' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** False for accounts that only sign in with Microsoft. */
  hasPassword: boolean;
  createdAt: string;
}

export interface AuthResponse extends Tokens {
  expiresIn: number;
  user: UserProfile;
}

interface Message {
  message: string;
}

export const authApi = {
  register: (body: { email: string; password: string; fullName: string }) =>
    apiRequest<Message>('POST', '/auth/register', { body }),

  resendCode: (email: string) =>
    apiRequest<Message>('POST', '/auth/resend-code', { body: { email } }),

  verifyEmail: (body: { email: string; password: string; code: string }) =>
    apiRequest<AuthResponse>('POST', '/auth/verify-email', { body }),

  login: (body: { email: string; password: string }) =>
    apiRequest<AuthResponse>('POST', '/auth/login', { body }),

  microsoftStart: () => apiRequest<{ nonce: string }>('POST', '/auth/microsoft/start'),

  microsoft: (idToken: string) =>
    apiRequest<AuthResponse>('POST', '/auth/microsoft', { body: { idToken } }),

  forgotPassword: (email: string) =>
    apiRequest<Message>('POST', '/auth/forgot-password', { body: { email } }),

  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    apiRequest<void>('POST', '/auth/reset-password', { body }),

  logout: (refreshToken: string) =>
    apiRequest<void>('POST', '/auth/logout', { body: { refreshToken } }),

  me: () => apiRequest<UserProfile>('GET', '/users/me', { auth: true }),
};
