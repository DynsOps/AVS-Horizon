/// <reference types="vite/client" />
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { externalLocalIdentityTokenRequest } from '../auth/authConfig';
import { externalMsalInstance } from '../auth/msalInstance';

// ─── ApiError ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly payload?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AUTH_BEARER_TOKEN_KEY = 'avs_auth_bearer_token';
const FUNCTION_API_BASE_URL = (import.meta.env.VITE_FUNCTION_API_BASE_URL || '').replace(/\/+$/, '');
const DEV_BYPASS_AUTH = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase() === 'true';

// ─── Token helpers ───────────────────────────────────────────────────────────

export const getStoredAuthBearerToken = (): string => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(AUTH_BEARER_TOKEN_KEY) || '';
};

export const setStoredAuthBearerToken = (token: string) =>
  localStorage.setItem(AUTH_BEARER_TOKEN_KEY, token);

export const clearStoredAuthBearerToken = () =>
  localStorage.removeItem(AUTH_BEARER_TOKEN_KEY);

// ─── Session / token refresh ─────────────────────────────────────────────────

const resetSessionAfterTokenRefreshFailure = (): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_BEARER_TOKEN_KEY);
  }
  const { setAuthError } = useAuthStore.getState();
  setAuthError('Oturum suresi doldu. Lutfen tekrar giris yapin.');
};

let refreshHostedTokenPromise: Promise<string | null> | null = null;

const refreshHostedTokenSilently = async (): Promise<string | null> => {
  if (refreshHostedTokenPromise) {
    return refreshHostedTokenPromise;
  }

  refreshHostedTokenPromise = (async () => {
    const activeAccount =
      externalMsalInstance.getActiveAccount() ||
      externalMsalInstance.getAllAccounts()[0] ||
      null;
    if (!activeAccount) return null;

    const tokenResult = await externalMsalInstance.acquireTokenSilent({
      ...externalLocalIdentityTokenRequest,
      account: activeAccount,
      forceRefresh: true,
    });

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_BEARER_TOKEN_KEY, tokenResult.idToken);
    }
    return tokenResult.idToken;
  })()
    .catch(() => {
      resetSessionAfterTokenRefreshFailure();
      return null;
    })
    .finally(() => {
      refreshHostedTokenPromise = null;
    });

  return refreshHostedTokenPromise;
};

// ─── request<T> ─────────────────────────────────────────────────────────────

export async function request<T = unknown>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal },
  allowAuthRetry = true
): Promise<T> {
  if (!FUNCTION_API_BASE_URL) {
    throw new ApiError(0, 'Function API base URL is not configured.');
  }

  const token = getStoredAuthBearerToken();
  const devUserEmail = useAuthStore.getState().user?.email || '';
  const canUseDevBypass = DEV_BYPASS_AUTH && Boolean(devUserEmail);
  const activeCompanyId = useUIStore.getState().dashboardCompanyId || '';

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${FUNCTION_API_BASE_URL}/${normalizedPath}`, {
    ...init,
    signal: init?.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(canUseDevBypass ? { 'x-dev-user-email': devUserEmail } : {}),
      ...(activeCompanyId ? { 'x-active-company-id': activeCompanyId } : {}),
      ...(init?.headers || {}),
    },
  });

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      if (response.ok) throw new ApiError(response.status, 'Response was not valid JSON');
    }
  }

  if (!response.ok) {
    const payloadObj = payload as Record<string, unknown> | null;
    const message =
      (payloadObj?.error as string) ||
      (payloadObj?.message as string) ||
      `Request failed (${response.status})`;

    const method = (init?.method ?? 'GET').toUpperCase();
    if (allowAuthRetry && response.status === 401 && method === 'GET') {
      const refreshedToken = await refreshHostedTokenSilently();
      if (refreshedToken) {
        return request<T>(path, init, false);
      }
    }

    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

// ─── requestPublic<T> ────────────────────────────────────────────────────────

export async function requestPublic<T = unknown>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  if (!FUNCTION_API_BASE_URL) {
    throw new ApiError(0, 'Function API base URL is not configured.');
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const response = await fetch(`${FUNCTION_API_BASE_URL}/${normalizedPath}`, {
    ...init,
    signal: init?.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  let payload: unknown = null;
  const contentTypePublic = response.headers.get('content-type') ?? '';
  if (contentTypePublic.includes('application/json')) {
    try {
      payload = await response.json();
    } catch {
      if (response.ok) throw new ApiError(response.status, 'Response was not valid JSON');
    }
  }

  if (!response.ok) {
    const payloadObj = payload as Record<string, unknown> | null;
    const message =
      (payloadObj?.error as string) ||
      (payloadObj?.message as string) ||
      `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}
