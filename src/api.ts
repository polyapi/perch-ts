import { polyCustom } from './polyCustom';

const MAX_RETRIES = 3;
const MAX_THROTTLE_RETRIES = 5;
const RETRY_DELAY_MS = 100;
const DEFAULT_RETRY_AFTER_MS = 1000;
const MAX_RETRY_AFTER_MS = 60_000;

const parseRetryAfterMs = (value: string | null): number => {
  if (value == null || value === '') return DEFAULT_RETRY_AFTER_MS;
  const asSeconds = Number(value);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.min(asSeconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    return Math.min(Math.max(asDate - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }
  return DEFAULT_RETRY_AFTER_MS;
};

function isConnectionError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    ['ECONNRESET', 'ECONNABORTED', 'ETIMEDOUT', 'EPIPE', 'ECONNREFUSED'].some(
      (msg) => err.message.includes(msg),
    )
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

async function apiRequest(
  method: string,
  pathname: string,
  body?: unknown,
): Promise<any> {
  const url = `${polyCustom.baseUrl}${pathname}`;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  let lastError: unknown;
  let throttleRetries = 0;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
    try {
      // eslint-disable-next-line no-undef
      const res = await fetch(url, {
        method,
        headers: getHeaders(payload !== undefined),
        body: payload,
      });

      if (res.status === 429 && throttleRetries < MAX_THROTTLE_RETRIES) {
        throttleRetries += 1;
        await new Promise((r) =>
          setTimeout(r, parseRetryAfterMs(res.headers.get('retry-after'))),
        );
        attempt -= 1;
        continue;
      }

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
      throw new Error(
        `Invalid content-type.\nExpected json or text but received ${contentType}`,
      );
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
export const updateVariable = (
  id: string,
  value: any,
  expiresAt?: string | Date,
) =>
  apiRequest('PATCH', `/variables/${id}`, {
    value,
    expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
  });

export const getFunction = (path: string) =>
  apiRequest('GET', `/functions/any/${path}?usePathId=true&serializer=perch`);
export const getFunctionById = (id: string) =>
  apiRequest('GET', `/functions/any/${id}?serializer=perch`);
export const executeServerFunction = (
  path: string,
  body: Record<string, unknown>,
) =>
  apiRequest('POST', `/functions/server/${path}/execute?usePathId=true`, body);
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
