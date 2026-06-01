import { polyCustom } from './polyCustom';


function getHeaders(hasBody = false): Record<string, string> {
  return {
    Authorization: `Bearer ${polyCustom.executionApiKey}`,
    'x-poly-api-version': process.env.POLY_API_VERSION ?? '',
    'x-poly-execution-id': polyCustom.executionId,
    ...(hasBody && { 'Content-Type': 'application/json' }),
  };
}

async function apiRequest(method: string, pathname: string, body?: unknown): Promise<unknown> {
  const baseUrl = process.env.POLY_API_BASE_URL;
  if (!baseUrl) throw new Error('POLY_API_BASE_URL is not set.');
  const url = `${baseUrl}${pathname}`;
  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  const res = await fetch(url, {
    method,
    headers: getHeaders(payload !== undefined),
    body: payload,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request Failed.\nStatus Code: ${res.status}\n${text}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !/^application\/json/.test(contentType)) {
    throw new Error(`Invalid content-type.\nExpected application/json but received ${contentType}`);
  }

  return res.json();
}

export const getVariable = (path: string) =>
  apiRequest('GET', `/variables/${path}?usePathId=true`);
export const updateVariable = (id: string, value: any, expiresAt?: string | Date) =>
  apiRequest('PATCH', `/variables/${id}`, { value, expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt })

export const getFunction = (path: string) =>
  apiRequest('GET', `/functions/${path}?usePathId=true&includeSourceCode=true`);
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
