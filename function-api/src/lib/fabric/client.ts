import { env } from '../env';
import { getFabricAccessToken } from '../powerbi';

type GraphqlErrorItem = {
  message?: string;
};

type GraphqlEnvelope<TData> = {
  data?: TData;
  errors?: GraphqlErrorItem[];
};

export class FabricGraphqlError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'FabricGraphqlError';
    this.status = status;
  }
}

const getGraphqlErrorMessage = (payload: Partial<GraphqlEnvelope<unknown>>): string => {
  const messages = (payload.errors || []).map((item) => (item.message || '').trim()).filter(Boolean);
  if (messages.length === 0) return 'Fabric GraphQL request failed.';
  return messages.join(' | ');
};

export const isCompatibilityError = (error: unknown, tokens: string[]): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return tokens.some((token) => message.includes(token.toLowerCase()));
};

export const runGraphqlQuery = async <TData>(query: string, variables?: Record<string, unknown>): Promise<TData> => {
  if (!env.fabricGraphqlEndpoint) {
    throw new Error('Missing FABRIC_GRAPHQL_ENDPOINT');
  }

  const timeoutMs = Number.isFinite(env.fabricGraphqlTimeoutMs) && env.fabricGraphqlTimeoutMs > 0
    ? env.fabricGraphqlTimeoutMs
    : 10000;
  const accessToken = await getFabricAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(env.fabricGraphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables: variables || {},
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as GraphqlEnvelope<TData>;
    if (!response.ok) {
      const message = getGraphqlErrorMessage(payload);
      throw new FabricGraphqlError(`Fabric GraphQL request failed (${response.status}): ${message}`);
    }
    if (payload.errors && payload.errors.length > 0) {
      throw new FabricGraphqlError(getGraphqlErrorMessage(payload));
    }
    if (!payload.data) {
      throw new FabricGraphqlError('Fabric GraphQL response did not include a data payload.');
    }

    return payload.data;
  } catch (error) {
    if (error instanceof FabricGraphqlError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FabricGraphqlError(`Fabric GraphQL request timed out after ${timeoutMs}ms.`, 504);
    }
    const message = error instanceof Error ? error.message : 'Unknown Fabric GraphQL request error.';
    throw new FabricGraphqlError(message);
  } finally {
    clearTimeout(timer);
  }
};
