export const env = {
  externalIdTenantId: process.env.EXTERNAL_ID_TENANT_ID || '',
  externalIdClientId: process.env.EXTERNAL_ID_CLIENT_ID || '',
  externalIdClientSecret: process.env.EXTERNAL_ID_CLIENT_SECRET || '',
  externalIdAudience: process.env.EXTERNAL_ID_AUDIENCE || process.env.EXTERNAL_ID_CLIENT_ID || '',
  externalIdAuthority: (process.env.EXTERNAL_ID_AUTHORITY || '').replace(/\/+$/, ''),
  externalIdJwksUri: process.env.EXTERNAL_ID_JWKS_URI || '',
  externalIdIssuerDomain: process.env.EXTERNAL_ID_ISSUER_DOMAIN || '',
  mailTenantId: process.env.MAIL_TENANT_ID || process.env.EXTERNAL_ID_TENANT_ID || '',
  mailClientId: process.env.MAIL_CLIENT_ID || process.env.EXTERNAL_ID_CLIENT_ID || '',
  mailClientSecret: process.env.MAIL_CLIENT_SECRET || process.env.EXTERNAL_ID_CLIENT_SECRET || '',
  mailAuthority: (process.env.MAIL_AUTHORITY || '').replace(/\/+$/, ''),
  mailSender: process.env.MAIL_SENDER || process.env.EXTERNAL_ID_MAIL_SENDER || '',
  mailLoginUrl: process.env.MAIL_LOGIN_URL || '',
  mailLogoUrl: process.env.MAIL_LOGO_URL || '',
  mailGraphScope: process.env.MAIL_GRAPH_SCOPE || 'https://graph.microsoft.com/.default',
  mailSupportAdminEmail: process.env.MAIL_SUPPORT_ADMIN_EMAIL || '',
  externalIdIssuers: (process.env.EXTERNAL_ID_ISSUERS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
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
  fabricAadScope: process.env.FABRIC_AAD_SCOPE || 'https://api.fabric.microsoft.com/.default',
  fabricGraphqlEndpoint: process.env.FABRIC_GRAPHQL_ENDPOINT || '',
  fabricGraphqlTimeoutMs: Number(process.env.FABRIC_GRAPHQL_TIMEOUT_MS || '10000'),
  redisUrl: process.env.REDIS_URL || '',
  fabricCacheEnabledRaw: process.env.FABRIC_CACHE_ENABLED || 'true',
  fabricCacheGroupProjtablesTtlSecondsRaw: process.env.FABRIC_CACHE_GROUP_PROJTABLES_TTL_SECONDS || '604800',
  fabricCacheCompanyChainsTtlSecondsRaw: process.env.FABRIC_CACHE_COMPANY_CHAINS_TTL_SECONDS || '86400',
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

export const assertMailEnv = (): void => {
  if (!env.mailTenantId) throw new Error('Missing MAIL_TENANT_ID or EXTERNAL_ID_TENANT_ID');
  if (!env.mailClientId) throw new Error('Missing MAIL_CLIENT_ID or EXTERNAL_ID_CLIENT_ID');
  if (!env.mailClientSecret) throw new Error('Missing MAIL_CLIENT_SECRET or EXTERNAL_ID_CLIENT_SECRET');
  if (!env.mailSender) throw new Error('Missing MAIL_SENDER or EXTERNAL_ID_MAIL_SENDER');
};
