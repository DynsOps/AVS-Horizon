export const env = {
  azureTenantId: process.env.AZURE_AD_TENANT_ID || '',
  azureClientId: process.env.AZURE_AD_CLIENT_ID || '',
  azureAudience: process.env.AZURE_AD_AUDIENCE || process.env.AZURE_AD_CLIENT_ID || '',
  sqlServer: process.env.SQL_SERVER || '',
  sqlDatabase: process.env.SQL_DATABASE || '',
  sqlAuthMode: (process.env.SQL_AUTH_MODE || 'ManagedIdentity').toLowerCase(),
  sqlUser: process.env.SQL_USER || '',
  sqlPassword: process.env.SQL_PASSWORD || '',
};

export const assertEnv = (): void => {
  if (!env.azureTenantId) throw new Error('Missing AZURE_AD_TENANT_ID');
  if (!env.azureAudience) throw new Error('Missing AZURE_AD_AUDIENCE or AZURE_AD_CLIENT_ID');
  if (!env.sqlServer) throw new Error('Missing SQL_SERVER');
  if (!env.sqlDatabase) throw new Error('Missing SQL_DATABASE');
};
