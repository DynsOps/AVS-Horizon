import sql, { IResult } from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';
import { env } from './env';

const credential = new DefaultAzureCredential();

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
      database: env.sqlDatabase,
      user: env.sqlUser,
      password: env.sqlPassword,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    };
  }

  const tokenResponse = await credential.getToken('https://database.windows.net/.default');
  if (!tokenResponse?.token) {
    throw new Error('Failed to obtain managed identity token for Azure SQL.');
  }

  return {
    server: env.sqlServer,
    database: env.sqlDatabase,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: {
        token: tokenResponse.token,
      },
    },
  } as sql.config;
};

export const runQuery = async <T = any>(query: string, params?: QueryParams): Promise<IResult<T>> => {
  const config = await getConnectionConfig();
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  try {
    const request = addInputs(pool.request(), params);
    return await request.query<T>(query);
  } finally {
    await pool.close();
  }
};
