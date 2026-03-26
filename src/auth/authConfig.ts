import { Configuration, RedirectRequest } from '@azure/msal-browser';

const env = import.meta.env;

const tenantId = env.VITE_AZURE_AD_TENANT_ID || '';
const clientId = env.VITE_AZURE_AD_CLIENT_ID || '';
const redirectUri = env.VITE_AZURE_AD_REDIRECT_URI || window.location.origin;
const scopeValue = env.VITE_AZURE_AD_SCOPE || 'User.Read Calendars.Read';
const scopes = scopeValue
  .split(/[ ,]+/)
  .map((scope: string) => scope.trim())
  .filter(Boolean);

if (!tenantId || !clientId) {
  // Keep app bootable for password login mode; Microsoft button will fail gracefully.
  console.warn('MSAL is missing VITE_AZURE_AD_TENANT_ID or VITE_AZURE_AD_CLIENT_ID.');
}

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    redirectUri,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest: RedirectRequest = {
  scopes,
};
