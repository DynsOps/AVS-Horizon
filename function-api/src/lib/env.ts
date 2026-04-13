export const env = {
  azureTenantId: process.env.AZURE_AD_TENANT_ID || '',
  azureClientId: process.env.AZURE_AD_CLIENT_ID || '',
  azureAudience: process.env.AZURE_AD_AUDIENCE || process.env.AZURE_AD_CLIENT_ID || '',
  externalIdTenantId: process.env.EXTERNAL_ID_TENANT_ID || '',
  externalIdClientId: process.env.EXTERNAL_ID_CLIENT_ID || '',
  externalIdClientSecret: process.env.EXTERNAL_ID_CLIENT_SECRET || '',
  externalIdAudience: process.env.EXTERNAL_ID_AUDIENCE || process.env.EXTERNAL_ID_CLIENT_ID || '',
  externalIdAuthority: (process.env.EXTERNAL_ID_AUTHORITY || '').replace(/\/+$/, ''),
  externalIdJwksUri: process.env.EXTERNAL_ID_JWKS_URI || '',
  externalIdIssuerDomain: process.env.EXTERNAL_ID_ISSUER_DOMAIN || '',
  externalIdIssuers: (process.env.EXTERNAL_ID_ISSUERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  externalIdUserFlow: process.env.EXTERNAL_ID_USER_FLOW || '',
  externalIdGraphScope: process.env.EXTERNAL_ID_GRAPH_SCOPE || 'https://graph.microsoft.com/.default',
  sqlServer: process.env.SQL_SERVER || '',
  sqlPort: Number(process.env.SQL_PORT || '1433'),
  sqlDatabase: process.env.SQL_DATABASE || '',
  sqlAuthMode: (process.env.SQL_AUTH_MODE || 'ManagedIdentity').toLowerCase(),
  sqlUser: process.env.SQL_USER || '',
  sqlPassword: process.env.SQL_PASSWORD || '',
  sqlEncrypt: (process.env.SQL_ENCRYPT || 'true').toLowerCase() === 'true',
  sqlTrustServerCertificate: (process.env.SQL_TRUST_SERVER_CERTIFICATE || 'false').toLowerCase() === 'true',
  devBypassAuth: (process.env.DEV_BYPASS_AUTH || 'false').toLowerCase() === 'true',
  powerBiTenantId: process.env.POWERBI_TENANT_ID || '',
  powerBiClientId: process.env.POWERBI_CLIENT_ID || '',
  powerBiClientSecret: process.env.POWERBI_CLIENT_SECRET || '',
};

export const assertEnv = (): void => {
  if (!env.externalIdAudience) throw new Error('Missing EXTERNAL_ID_AUDIENCE or EXTERNAL_ID_CLIENT_ID');
  if (!env.externalIdJwksUri) throw new Error('Missing EXTERNAL_ID_JWKS_URI');
  if (env.externalIdIssuers.length === 0) throw new Error('Missing EXTERNAL_ID_ISSUERS');
  if (!env.sqlServer) throw new Error('Missing SQL_SERVER');
  if (!env.sqlDatabase) throw new Error('Missing SQL_DATABASE');
};

export const assertExternalIdEnv = (): void => {
  if (!env.externalIdTenantId) throw new Error('Missing EXTERNAL_ID_TENANT_ID');
  if (!env.externalIdClientId) throw new Error('Missing EXTERNAL_ID_CLIENT_ID');
  if (!env.externalIdClientSecret) throw new Error('Missing EXTERNAL_ID_CLIENT_SECRET');
  if (!env.externalIdAuthority) throw new Error('Missing EXTERNAL_ID_AUTHORITY');
  if (!env.externalIdIssuerDomain) throw new Error('Missing EXTERNAL_ID_ISSUER_DOMAIN');
};
