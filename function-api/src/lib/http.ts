import { HttpResponseInit } from '@azure/functions';

const mergeHeaders = (base: Record<string, string>, extra?: Record<string, string>): Record<string, string> => ({
  ...base,
  ...(extra || {}),
});

export const json = (status: number, body: unknown, headers?: Record<string, string>): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: mergeHeaders({ 'Content-Type': 'application/json' }, headers),
});

export const ok = (body: unknown, headers?: Record<string, string>): HttpResponseInit => json(200, body, headers);
export const created = (body: unknown, headers?: Record<string, string>): HttpResponseInit => json(201, body, headers);

export const errorResponse = (status: number, message: string): HttpResponseInit => {
  return json(status, { error: message });
};
