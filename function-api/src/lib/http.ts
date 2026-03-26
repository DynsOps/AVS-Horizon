import { HttpResponseInit } from '@azure/functions';

export const json = (status: number, body: unknown): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const ok = (body: unknown): HttpResponseInit => json(200, body);
export const created = (body: unknown): HttpResponseInit => json(201, body);

export const errorResponse = (status: number, message: string): HttpResponseInit => {
  return json(status, { error: message });
};
