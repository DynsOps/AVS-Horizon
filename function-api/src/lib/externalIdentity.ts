import { randomBytes } from 'crypto';
import { assertExternalIdEnv, env } from './env';

export type ExternalLocalAccountResult = {
  entraObjectId: string;
  temporaryPassword: string;
  identityTenantId: string;
};

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

const buildMailNickname = (email: string): string => {
  const localPart = email.split('@')[0] || 'external-user';
  return localPart
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 48) || 'external-user';
};

const generateTemporaryPassword = (): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+';
  const bytes = randomBytes(20);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
};

const getAuthorityTokenEndpoint = (): string => `${env.externalIdAuthority}/oauth2/v2.0/token`;

const getExternalGraphAccessToken = async (): Promise<string> => {
  assertExternalIdEnv();
  const body = new URLSearchParams({
    client_id: env.externalIdClientId,
    client_secret: env.externalIdClientSecret,
    scope: env.externalIdGraphScope,
    grant_type: 'client_credentials',
  });

  const response = await fetch(getAuthorityTokenEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new Error(payload?.error_description || payload?.error || 'Failed to acquire External ID graph token.');
  }

  return payload.access_token;
};

const callGraph = async <T = any>(path: string, init: RequestInit): Promise<T> => {
  const token = await getExternalGraphAccessToken();
  const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error_description || `External ID request failed (${response.status})`);
  }

  return payload as T;
};

export const createExternalLocalAccount = async (params: {
  email: string;
  displayName: string;
}): Promise<ExternalLocalAccountResult> => {
  const temporaryPassword = generateTemporaryPassword();
  const payload = await callGraph<{ id: string }>('/users', {
    method: 'POST',
    body: JSON.stringify({
      accountEnabled: true,
      displayName: params.displayName,
      mail: params.email,
      mailNickname: buildMailNickname(params.email),
      identities: [
        {
          signInType: 'emailAddress',
          issuer: env.externalIdIssuerDomain,
          issuerAssignedId: params.email,
        },
      ],
      passwordProfile: {
        password: temporaryPassword,
        forceChangePasswordNextSignIn: true,
      },
      passwordPolicies: 'DisablePasswordExpiration',
    }),
  });

  if (!payload.id) {
    throw new Error('External ID user creation returned no user id.');
  }

  return {
    entraObjectId: payload.id,
    temporaryPassword,
    identityTenantId: env.externalIdTenantId,
  };
};

export const deleteExternalIdentityUser = async (entraObjectId: string): Promise<void> => {
  if (!entraObjectId) return;
  await callGraph(`/users/${entraObjectId}`, {
    method: 'DELETE',
  });
};
