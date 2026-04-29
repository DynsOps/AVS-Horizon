import { request, getStoredAuthBearerToken, clearStoredAuthBearerToken } from '../../lib/apiClient';
import type { User, HostedIdentityTokenRecord } from '../../types';

const FUNCTION_API_BASE_URL = (import.meta.env.VITE_FUNCTION_API_BASE_URL || '').replace(/\/+$/, '');
const DEV_BYPASS_AUTH = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase() === 'true';
const AUTH_BEARER_TOKEN_KEY = 'avs_auth_bearer_token';

export const auth = {
  checkAccess: (email: string, bearerToken?: string): Promise<User> =>
    auth.loginWithHostedIdentity(email, bearerToken),

  loginWithHostedIdentity: async (email: string, bearerToken?: string): Promise<User> => {
    const normalizedEmail = email.trim().toLowerCase();
    const token = bearerToken || getStoredAuthBearerToken();
    const canUseDevBypass = DEV_BYPASS_AUTH && Boolean(normalizedEmail);
    if (!token && !canUseDevBypass) {
      throw new Error('Sign-in token is missing. Please sign in again.');
    }

    const response = await fetch(`${FUNCTION_API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(canUseDevBypass ? { 'x-dev-user-email': normalizedEmail } : {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Function API request failed (${response.status})`);
    }
    return payload.user as User;
  },

  storeHostedToken: async (payload: {
    userEmail: string;
    bearerToken: string;
    scope: string;
    expiresAt?: string;
    provider?: 'external_local';
  }): Promise<void> => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_BEARER_TOKEN_KEY, payload.bearerToken);
    }
  },

  getHostedToken: async (_userEmail: string): Promise<HostedIdentityTokenRecord | null> => {
    return null;
  },

  clearHostedToken: async (_userEmail?: string): Promise<void> => {
    clearStoredAuthBearerToken();
  },

  login: (email: string): Promise<User> => auth.loginWithHostedIdentity(email),

  updateProfile: async (_userId: string, data: Partial<User>): Promise<User> => {
    const p = await request<{ user: User }>('api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name: (data.name || '').trim() }),
    });
    return p.user;
  },
};
