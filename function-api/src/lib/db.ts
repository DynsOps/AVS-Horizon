import sql, { IResult } from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';
import { env } from './env';
import { buildSessionContextPrefix, SessionContext } from './identity';

const credential = new DefaultAzureCredential();
let pooledConnection: Promise<sql.ConnectionPool> | null = null;

type QueryParams = Record<string, string | number | boolean | Date | null | undefined>;

const addInputs = (request: sql.Request, params?: QueryParams): sql.Request => {
  if (!params) return request;
  Object.entries(params).forEach(([key, value]) => {
    request.input(key, value as any);
  });
  return request;
};

const getConnectionConfig = async (): Promise<sql.config> => {
  if (env.sqlAuthMode === 'sqlpassword') {
    return {
      server: env.sqlServer,
      port: env.sqlPort,
      database: env.sqlDatabase,
      user: env.sqlUser,
      password: env.sqlPassword,
      requestTimeout: 30000,
      connectionTimeout: 15000,
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: env.sqlEncrypt,
        trustServerCertificate: env.sqlTrustServerCertificate,
      },
    };
  }

  const tokenResponse = await credential.getToken('https://database.windows.net/.default');
  if (!tokenResponse?.token) {
    throw new Error('Failed to obtain managed identity token for Azure SQL.');
  }

  return {
    server: env.sqlServer,
    port: env.sqlPort,
    database: env.sqlDatabase,
    requestTimeout: 30000,
    connectionTimeout: 15000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      encrypt: env.sqlEncrypt,
      trustServerCertificate: env.sqlTrustServerCertificate,
    },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: {
        token: tokenResponse.token,
      },
    },
  } as sql.config;
};

const getPool = async (): Promise<sql.ConnectionPool> => {
  if (!pooledConnection) {
    pooledConnection = (async () => {
      const config = await getConnectionConfig();
      const pool = new sql.ConnectionPool(config);
      pool.on('error', () => {
        pooledConnection = null;
      });
      await pool.connect();
      return pool;
    })();
  }
  return pooledConnection;
};

const shouldReconnect = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = (error.message || '').toLowerCase();
  return (
    message.includes('token') ||
    message.includes('econn') ||
    message.includes('connection') ||
    message.includes('elogin')
  );
};

export const runQuery = async <T = any>(query: string, params?: QueryParams): Promise<IResult<T>> => {
  try {
    const pool = await getPool();
    const request = addInputs(pool.request(), params);
    return await request.query<T>(query);
  } catch (error) {
    if (shouldReconnect(error)) {
      pooledConnection = null;
      const retryPool = await getPool();
      const retryRequest = addInputs(retryPool.request(), params);
      return await retryRequest.query<T>(query);
    }
    throw error;
  }
};

export const runScopedQuery = async <T = any>(
  context: SessionContext,
  query: string,
  params?: QueryParams
): Promise<IResult<T>> => {
  const scopedQuery = `${buildSessionContextPrefix(context)}\n${query}`;
  return runQuery<T>(scopedQuery, params);
};
