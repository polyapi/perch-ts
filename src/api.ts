import { polyCustom } from './polyCustom';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

function isConnectionError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED'].some(msg => err.message.includes(msg))
  );
}

function getHeaders(hasBody = false): Record<string, string> {
  return {
    Authorization: `Bearer ${polyCustom.executionApiKey}`,
    'x-poly-api-version': polyCustom.polyApiVersion ?? '',
    'x-poly-execution-id': polyCustom.executionId,
    ...(hasBody && { 'Content-Type': 'application/json' }),
  };
}

async function apiRequest(method: string, pathname: string, body?: unknown): Promise<any> {
  const url = `${polyCustom.baseUrl}${pathname}`;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
    try {
      const res = await fetch(url, {
        method,
        headers: getHeaders(payload !== undefined),
        body: payload,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Request Failed.\nStatus Code: ${res.status}\n${text}`);
      }

      const contentType = res.headers.get('content-type') || '';

      if (/^application\/json/.test(contentType)) {
        return res.json();
      }

      if (/^text/.test(contentType)) {
        return res.text();
      }
      throw new Error(`Invalid content-type.\nExpected json or text but received ${contentType}`);
    } catch (err) {
      if (isConnectionError(err)) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export const getVariable = (path: string) =>
  apiRequest('GET', `/variables/${path}?usePathId=true`);
export const getVariableValue = (id: string) =>
  apiRequest('GET', `/variables/${id}/value`);
export const updateVariable = (id: string, value: any, expiresAt?: string | Date) =>
  apiRequest('PATCH', `/variables/${id}`, { value, expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt })

export const getFunction = (path: string) =>
  apiRequest('GET', `/functions/${path}?usePathId=true&serializer=perch`);
export const executeServerFunction = (
  path: string,
  body: Record<string, unknown>,
) => apiRequest('POST', `/functions/server/${path}/execute?usePathId=true`, body);
export const executeApiFunction = (
  path: string,
  body: Record<string, unknown>,
) => apiRequest('POST', `/functions/api/${path}/execute?usePathId=true`, body);

export const getTable = (path: string) =>
  apiRequest('GET', `/tables/${path}?usePathId=true`);
export const queryTable = (
  type: string,
  path: string,
  query: Record<string, unknown>,
) => apiRequest('POST', `/tables/${path}/${type}?usePathId=true`, query);
