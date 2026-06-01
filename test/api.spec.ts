import {
  getVariable,
  updateVariable,
  getFunction,
  executeServerFunction,
  executeApiFunction,
  getTable,
  queryTable,
} from '../src/api';
import { executeWithPolyCustom } from '../src/polyCustom';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const BASE_URL = 'http://poly-api.internal';
const API_VERSION = '1';
const EXECUTION_API_KEY = 'test-api-key';
const EXECUTION_ID = 'test-execution-id';

const defaultPolyCustom = {
  executionApiKey: EXECUTION_API_KEY,
  executionId: EXECUTION_ID,
};

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status <= 299,
    status,
    headers: { get: (h: string) => h === 'content-type' ? 'application/json' : null },
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function mockErrorResponse(status: number, body = 'Internal Server Error') {
  return {
    ok: false,
    status,
    headers: { get: () => 'text/plain' },
    json: jest.fn(),
    text: jest.fn().mockResolvedValue(body),
  };
}

function mockWrongContentTypeResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'text/html' },
    json: jest.fn(),
    text: jest.fn().mockResolvedValue(String(body)),
  };
}

function withExecution<T>(fn: () => Promise<T>) {
  return executeWithPolyCustom(fn as () => Promise<unknown>, defaultPolyCustom) as Promise<{ data: T, polyCustom: typeof defaultPolyCustom }>;
}

function expectCorrectHeaders(hasBody = false) {
  expect(mockFetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: `Bearer ${EXECUTION_API_KEY}`,
        'x-poly-api-version': API_VERSION,
        'x-poly-execution-id': EXECUTION_ID,
        ...(hasBody && { 'Content-Type': 'application/json' }),
      }),
    }),
  );
}

beforeEach(() => {
  process.env.POLY_API_BASE_URL = BASE_URL;
  process.env.POLY_API_VERSION = API_VERSION;
});

describe('apiRequest', () => {
  it('throws if POLY_API_BASE_URL is not set', async () => {
    delete process.env.POLY_API_BASE_URL;
    await expect(
      withExecution(() => getVariable('foo.bar'))
    ).rejects.toThrow('POLY_API_BASE_URL is not set.');
  });

  it('throws on non-ok response with status and body', async () => {
    mockFetch.mockResolvedValue(mockErrorResponse(500, 'Something went wrong'));
    await expect(
      withExecution(() => getVariable('foo.bar'))
    ).rejects.toThrow('Request Failed.\nStatus Code: 500\nSomething went wrong');
  });

  it('throws on wrong content-type', async () => {
    mockFetch.mockResolvedValue(mockWrongContentTypeResponse('<html>error</html>'));
    await expect(
      withExecution(() => getVariable('foo.bar'))
    ).rejects.toThrow('Invalid content-type.\nExpected application/json but received text/html');
  });

  it('throws on null content-type', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: jest.fn(),
      text: jest.fn(),
    });
    await expect(
      withExecution(() => getVariable('foo.bar'))
    ).rejects.toThrow('Invalid content-type.');
  });

  it('reads executionApiKey and executionId from polyCustom at call time', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ value: 'x' }));
    await withExecution(() => getVariable('foo'));
    expectCorrectHeaders();
  });
});

describe('getVariable', () => {
  it('works as exepcted', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ value: 42 }));
    const { data } = await withExecution(() => getVariable('my.variable'));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/variables/my.variable?usePathId=true`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(data).toEqual({ value: 42 });
  });

  it('sends correct headers without Content-Type', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({}));
    await withExecution(() => getVariable('foo'));
    expectCorrectHeaders(false);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: undefined }),
    );
  });
});

describe('updateVariable', () => {
  it('can update value', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ value: 42 }));
    const { data } = await withExecution(() => updateVariable('123', 42));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/variables/123`,
      expect.objectContaining({ method: 'PATCH', body: '{"value":42}' }),
    );
    expect(data).toEqual({ value: 42 });
  });

  it('can update value and expiresAt timestamp', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ value: 42 }));
    const { data } = await withExecution(() => updateVariable('123', 42, '2025-02-03T12:30:30:000Z'));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/variables/123`,
      expect.objectContaining({ method: 'PATCH', body: '{"value":42,"expiresAt":"2025-02-03T12:30:30:000Z"}' }),
    );
    expect(data).toEqual({ value: 42 });
  });

  it('sends correct headers without Content-Type', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({}));
    await withExecution(() => getVariable('foo'));
    expectCorrectHeaders(false);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: undefined }),
    );
  });
});

describe('getFunction', () => {
  it('works as exepcted', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ sourceCode: 'export default ...' }));
    await withExecution(() => getFunction('my.function'));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/functions/my.function?usePathId=true&includeSourceCode=true`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('executeServerFunction', () => {
  it('works as exepcted', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ result: 'ok' }));
    const body = { arg1: 'value' };
    const { data } = await withExecution(() => executeServerFunction('my.function', body));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/functions/server/my.function/execute?usePathId=true`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
    expect(data).toEqual({ result: 'ok' });
  });

  it('sends Content-Type header', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({}));
    await withExecution(() => executeServerFunction('fn', { x: 1 }));
    expectCorrectHeaders(true);
  });
});

describe('executeApiFunction', () => {
  it('works as exepcted', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ result: 'ok' }));
    const body = { arg1: 'value' };
    await withExecution(() => executeApiFunction('my.function', body));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/functions/api/my.function/execute?usePathId=true`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  });
});

describe('getTable', () => {
  it('works as exepcted', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ rows: [] }));
    await withExecution(() => getTable('my.table'));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/tables/my.table?usePathId=true`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('queryTable', () => {
  it('works as exepcted', async () => {
    mockFetch.mockResolvedValue(mockJsonResponse({ rows: [{ id: 1 }] }));
    const query = { filter: { id: 1 } };
    const { data } = await withExecution(() => queryTable('search', 'my.table', query));
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/tables/my.table/search?usePathId=true`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(query),
      }),
    );
    expect(data).toEqual({ rows: [{ id: 1 }] });
  });
});