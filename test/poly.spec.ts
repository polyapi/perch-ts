import { poly, executeTopLevelServerFunction } from '../src/poly';
import { getFunction, executeApiFunction, executeServerFunction } from '../src/api';
import { executeWithPolyCustom } from '../src/polyCustom';

jest.mock('../src/api');

const mockGetFunction = getFunction as jest.MockedFunction<typeof getFunction>;
const mockExecuteApiFunction = executeApiFunction as jest.MockedFunction<typeof executeApiFunction>;
const mockExecuteServerFunction = executeServerFunction as jest.MockedFunction<typeof executeServerFunction>;

const defaultPolyCustom = {
  executionId: 'test-exec',
  executionApiKey: 'test-key',
  baseUrl: 'http://poly-api.internal',
  polyApiVersion: '1',
};

function withExecution<T>(fn: () => Promise<T>) {
  return executeWithPolyCustom(fn as () => Promise<unknown>, defaultPolyCustom);
}

function mockFn(overrides = {}) {
  return {
    id: 'fn-uuid-123',
    name: 'myFunction',
    type: 'serverFunction',
    arguments: [
      { key: 'arg1' },
      { key: 'arg2' },
    ],
    code: '',
    ...overrides,
  };
}

describe('poly.id', () => {
  it('fetches function and returns its id', async () => {
    mockGetFunction.mockResolvedValue(mockFn({ id: 'fn-uuid-123' }));
    const { data } = await withExecution(() => poly.my.function.id.test1.id());
    expect(mockGetFunction).toHaveBeenCalledWith('my.function.id.test1.id');
    expect(data).toBe('fn-uuid-123');
  });

  it('caches the function — only fetches once across multiple calls', async () => {
    mockGetFunction.mockResolvedValue(mockFn());
    await withExecution(() => poly.my.function.id.test2.id());
    await withExecution(() => poly.my.function.id.test2.id());
    expect(mockGetFunction).toHaveBeenCalledTimes(1);
  });
});

describe('poly - top level server function', () => {
  it('works', async () => {
    mockGetFunction.mockResolvedValue(mockFn({
      type: 'serverFunction',
      name: 'add',
      code: 'async function add(a, b, c) { return Promise.resolve((a + b) * c); }',
      arguments: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    }));

    
    const { data } = await withExecution(
      () => executeTopLevelServerFunction('fn-uuid-123', [2, 3, 4])
    );
    expect(data).toBe(20);
  });
});

describe('poly — serverFunction', () => {
  it('maps positional args to named body keys and calls executeServerFunction', async () => {
    mockGetFunction.mockResolvedValue(mockFn({ type: 'serverFunction' }));
    mockExecuteServerFunction.mockResolvedValue({ result: 'ok' });

    const { data } = await withExecution(() =>
      poly.my.function.server.test1('val1', 'val2')
    );

    expect(mockExecuteServerFunction).toHaveBeenCalledWith(
      'my.function.server.test1',
      { arg1: 'val1', arg2: 'val2' },
    );
    expect(data).toEqual({ result: 'ok' });
  });

  it('caches the function definition', async () => {
    mockGetFunction.mockResolvedValue(mockFn({ type: 'serverFunction' }));
    mockExecuteServerFunction.mockResolvedValue({});
    await withExecution(() => poly.my.function.server.test2());
    await withExecution(() => poly.my.function.server.test2());
    expect(mockGetFunction).toHaveBeenCalledTimes(1);
  });

  it('passes empty body when function has no arguments', async () => {
    mockGetFunction.mockResolvedValue(mockFn({ type: 'serverFunction', arguments: [] }));
    mockExecuteServerFunction.mockResolvedValue({});
    await withExecution(() => poly.my.function.server.test3());
    expect(mockExecuteServerFunction).toHaveBeenCalledWith(
      'my.function.server.test3',
      {},
    );
  });
});

describe('poly — apiFunction', () => {
  it('maps positional args to named body keys and calls executeApiFunction', async () => {
    mockGetFunction.mockResolvedValue(mockFn({ type: 'apiFunction' }));
    mockExecuteApiFunction.mockResolvedValue({ result: 'ok' });

    const { data } = await withExecution(() =>
      poly.my.function.api.test1('val1', 'val2')
    );

    expect(mockExecuteApiFunction).toHaveBeenCalledWith(
      'my.function.api.test1',
      { arg1: 'val1', arg2: 'val2' },
    );
    expect(data).toEqual({ result: 'ok' });
  });
});

describe('poly — clientFunction', () => {
  it('executes function code in-process and returns result', async () => {
    mockGetFunction.mockResolvedValue(mockFn({
      type: 'clientFunction',
      name: 'add',
      code: 'async function add(a, b, c) { return (a + b) * c; }',
      arguments: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    }));

    const { data } = await withExecution(() =>
      poly.my.function.client.test1(2, 3, 4)
    );
    expect(data).toBe(20);
  });

  it('does not call executeServerFunction or executeApiFunction', async () => {
    mockGetFunction.mockResolvedValue(mockFn({
      type: 'clientFunction',
      name: 'noop',
      code: 'function noop() { return null; }',
      arguments: [],
    }));

    const { data } = await withExecution(() => poly.my.function.client.test2());
    expect(data).toBe(null);
    expect(mockExecuteServerFunction).not.toHaveBeenCalled();
    expect(mockExecuteApiFunction).not.toHaveBeenCalled();
  });
});

describe('poly — unknown function type', () => {
  it('throws for unrecognised function type', async () => {
    mockGetFunction.mockResolvedValue(mockFn({ type: 'magicFunction' }));
    await expect(
      withExecution(() => poly.my.function.unknown.test1())
    ).rejects.toThrow("Unknown function type for 'my.function.unknown.test1'");
  });
});