import { env } from './env';

type AadTokenResponse = {
  access_token: string;
};

type GenerateTokenResponse = {
  token: string;
  expiration: string;
};

const POWERBI_SCOPE = 'https://analysis.windows.net/powerbi/api/.default';

const assertPowerBiEnv = (): void => {
  if (!env.powerBiTenantId) throw new Error('Missing POWERBI_TENANT_ID');
  if (!env.powerBiClientId) throw new Error('Missing POWERBI_CLIENT_ID');
  if (!env.powerBiClientSecret) throw new Error('Missing POWERBI_CLIENT_SECRET');
};

const getPowerBiAccessToken = async (): Promise<string> => {
  assertPowerBiEnv();

  const formBody = new URLSearchParams({
    client_id: env.powerBiClientId,
    client_secret: env.powerBiClientSecret,
    grant_type: 'client_credentials',
    scope: POWERBI_SCOPE,
  });

  const response = await fetch(`https://login.microsoftonline.com/${env.powerBiTenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<AadTokenResponse> & { error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `Power BI AAD token request failed (${response.status})`);
  }

  return payload.access_token;
};

export const generateReportEmbedToken = async (params: {
  workspaceId: string;
  reportId: string;
  datasetId: string;
  username: string;
  roles: string[];
}): Promise<{ embedToken: string; expiration: string; embedUrl: string }> => {
  const accessToken = await getPowerBiAccessToken();
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${params.workspaceId}/reports/${params.reportId}/GenerateToken`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accessLevel: 'View',
      identities: [
        {
          username: params.username,
          roles: params.roles,
          datasets: [params.datasetId],
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<GenerateTokenResponse> & { message?: string };
  if (!response.ok || !payload.token || !payload.expiration) {
    throw new Error(payload.message || `Power BI GenerateToken failed (${response.status})`);
  }

  return {
    embedToken: payload.token,
    expiration: payload.expiration,
    embedUrl: `https://app.powerbi.com/reportEmbed?reportId=${params.reportId}&groupId=${params.workspaceId}&ctid=${env.powerBiTenantId}`,
  };
};
