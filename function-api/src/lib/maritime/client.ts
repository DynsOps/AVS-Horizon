import { env } from '../env';

export class MaritimeApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'MaritimeApiError';
  }
}

export interface DatadockedResult {
  name: string;
  imo: string;
  mmsi: string;
  latitude: string;
  longitude: string;
  etaUtc: string;
  atdUtc: string;
  course: string;
  heading: string;
  speed: string;
  draught: string;
  navigationalStatus: string;
  destination: string;
  lastPort: string;
  callsign: string;
  positionReceived: string;
  updateTime: string;
  unlocodeDestination: string;
  unlocodeLastport: string;
  typeSpecific: string;
  dataSource: string;
}

interface DatadockedBulkResponse {
  total_requested: number;
  successful: number;
  failed: number;
  results: DatadockedResult[];
  userRequest: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function fetchBatch(imos: string[]): Promise<DatadockedResult[]> {
  const url = `${env.datadockedBaseUrl}/api/vessels_operations/get-vessels-location-bulk-search?imo_or_mmsi=${imos.join(',')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.datadockedTimeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-api-key': env.datadockedApiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Datadocked request failed (${response.status})`;
      try {
        const body = (await response.json()) as { message?: string; error?: string };
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {
        // ignore parse errors on error responses
      }
      throw new MaritimeApiError(message, response.status);
    }

    let payload: DatadockedBulkResponse;
    try {
      payload = (await response.json()) as DatadockedBulkResponse;
    } catch {
      throw new MaritimeApiError('Invalid response from Datadocked', 502);
    }

    if (payload.failed > 0) {
      console.warn(`[maritime] Datadocked: ${payload.failed} of ${payload.total_requested} vessels not found`);
    }

    return payload.results ?? [];
  } catch (error) {
    if (error instanceof MaritimeApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new MaritimeApiError('Datadocked request timed out', 504);
    }
    const message = error instanceof Error ? error.message : 'Unknown Datadocked request error.';
    throw new MaritimeApiError(message, 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDatadockedPositions(imos: string[]): Promise<DatadockedResult[]> {
  if (imos.length === 0) return [];
  const batches = chunk(imos, 50);
  const settled = await Promise.allSettled(batches.map((batch) => fetchBatch(batch)));
  const results: DatadockedResult[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      results.push(...outcome.value);
    } else {
      // Log failed batch but continue with available results
      console.warn('[maritime] Datadocked batch failed:', outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason));
    }
  }
  return results;
}
