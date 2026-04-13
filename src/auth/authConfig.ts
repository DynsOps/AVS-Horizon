import { Configuration, RedirectRequest } from '@azure/msal-browser';

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

const externalAuthority = normalizeExternalBrowserAuthority(env.VITE_EXTERNAL_ID_AUTHORITY || '');
const externalClientId = env.VITE_EXTERNAL_ID_CLIENT_ID || '';
const externalRedirectUri = env.VITE_EXTERNAL_ID_REDIRECT_URI || window.location.origin;
const externalScopeValue = env.VITE_EXTERNAL_ID_SCOPE || '';
const externalMicrosoftIdpHint = env.VITE_EXTERNAL_ID_MICROSOFT_IDP_HINT || 'microsoft';
const hasPlaceholderValue = (value: string): boolean => value.includes('<') || value.includes('>');
const externalAuthorityHost = getAuthorityHost(externalAuthority);
export const isExternalLocalAuthConfigured = Boolean(
  externalAuthority &&
  externalClientId &&
  !hasPlaceholderValue(externalAuthority) &&
  !hasPlaceholderValue(externalClientId)
);
const configuredExternalScopes = externalScopeValue
  .split(/[ ,]+/)
  .map((scope: string) => scope.trim())
  .filter(Boolean);

const externalApiScopes = configuredExternalScopes.filter((scope: string) => scope.startsWith('api://'));

if (!externalClientId) {
  console.warn('MSAL is missing VITE_EXTERNAL_ID_CLIENT_ID.');
}

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
  scopes: ['openid', 'profile', 'email'],
  authority: isExternalLocalAuthConfigured ? externalAuthority : undefined,
};

export const federatedMicrosoftLoginRequest: RedirectRequest = {
  scopes: ['openid', 'profile', 'email'],
  authority: isExternalLocalAuthConfigured ? externalAuthority : undefined,
  extraQueryParameters: externalMicrosoftIdpHint
    ? {
        idp: externalMicrosoftIdpHint,
      }
    : undefined,
};

export const externalApiTokenRequest: RedirectRequest = {
  scopes: externalApiScopes,
  authority: isExternalLocalAuthConfigured ? externalAuthority : undefined,
};
