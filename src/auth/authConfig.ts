import { Configuration, RedirectRequest, SilentRequest } from '@azure/msal-browser';

const env = import.meta.env;

const normalizeExternalBrowserAuthority = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.endsWith('.ciamlogin.com')) {
      return `${parsed.protocol}//${parsed.host}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const getAuthorityHost = (value: string): string => {
  if (!value) return '';

  try {
    return new URL(value).host;
  } catch {
    return '';
  }
};

const hasPlaceholderValue = (value: string): boolean => value.includes('<') || value.includes('>');

const externalAuthority = normalizeExternalBrowserAuthority(env.VITE_EXTERNAL_ID_AUTHORITY || '');
const externalClientId = env.VITE_EXTERNAL_ID_CLIENT_ID || '';
const externalRedirectUri = env.VITE_EXTERNAL_ID_REDIRECT_URI || window.location.origin;
const externalAuthorityHost = getAuthorityHost(externalAuthority);

export const isExternalLocalAuthConfigured = Boolean(
  externalAuthority &&
    externalClientId &&
    !hasPlaceholderValue(externalAuthority) &&
    !hasPlaceholderValue(externalClientId)
);

const identityScopes = ['openid', 'profile', 'email'];

export const externalMsalConfig: Configuration = {
  auth: {
    clientId: externalClientId,
    authority: externalAuthority,
    ...(externalAuthorityHost ? { knownAuthorities: [externalAuthorityHost] } : {}),
    redirectUri: externalRedirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const externalLocalLoginRequest: RedirectRequest = {
  scopes: identityScopes,
  authority: isExternalLocalAuthConfigured ? externalAuthority : undefined,
};

export const externalLocalIdentityTokenRequest: SilentRequest = {
  scopes: identityScopes,
  authority: isExternalLocalAuthConfigured ? externalAuthority : undefined,
};
