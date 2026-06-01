import { vari } from '../src/vari';
import { getVariable, updateVariable } from '../src/api';
import { executeWithPolyCustom } from '../src/polyCustom';

jest.mock('../src/api');

const mockGetVariable = getVariable as jest.MockedFunction<typeof getVariable>;
const mockUpdateVariable = updateVariable as jest.MockedFunction<typeof updateVariable>;

const defaultPolyCustom = {
  executionId: 'test-exec',
  executionApiKey: 'test-key',
};

function withExecution(fn: () => Promise<any>) {
  return executeWithPolyCustom(fn as () => Promise<any>, defaultPolyCustom);
}

function mockVariable(overrides = {}) {
  return {
    id: 'var-uuid-123',
    value: 'my-value',
    secrecy: 'NONE',
    ...overrides,
  };
}

describe('vari.inject', () => {
  it('returns a PolyVariable reference with path', async () => {
    const { data } = await withExecution(() => vari.my.variable.inject());
    expect(data).toEqual({
      type: 'PolyVariable',
      pathIdentifier: 'my.variable',
      subpath: undefined,
    });
  });

  it('includes subpath if provided', async () => {
    const { data } = await withExecution(() => vari.my.variable.inject('sub'));
    expect(data).toEqual({
      type: 'PolyVariable',
      pathIdentifier: 'my.variable',
      subpath: 'sub',
    });
  });

  it('does not call the api', async () => {
    await withExecution(() => vari.my.variable.inject());
    expect(mockGetVariable).not.toHaveBeenCalled();
  });
});

describe('vari.get', () => {
  it('fetches variable and returns its value', async () => {
    mockGetVariable.mockResolvedValue(mockVariable({ value: 'hello' }));
    const { data } = await withExecution(() => vari.my.variable.get.test1.get());
    expect(mockGetVariable).toHaveBeenCalledWith('my.variable.get.test1');
    expect(data).toBe('hello');
  });

  it('throws if variable is SECRET', async () => {
    mockGetVariable.mockResolvedValue(mockVariable({ secrecy: 'SECRET' }));
    await expect(
      withExecution(() => vari.my.variable.get.test2.get())
    ).rejects.toThrow('Cannot access secret variable from client.');
  });

  it('caches the variable — only fetches once across multiple calls', async () => {
    mockGetVariable.mockResolvedValue(mockVariable());
    await withExecution(() => vari.my.variable.get.test3.get());
    await withExecution(() => vari.my.variable.get.test3.get());
    expect(mockGetVariable).toHaveBeenCalledTimes(1);
  });
});

describe('vari.id', () => {
  it('fetches variable and returns its id', async () => {
    mockGetVariable.mockResolvedValue(mockVariable({ id: 'var-uuid-123' }));
    const { data } = await withExecution(() => vari.my.variable.id.test1.id());
    expect(mockGetVariable).toHaveBeenCalledWith('my.variable.id.test1');
    expect(data).toBe('var-uuid-123');
  });

  it('caches the variable — only fetches once across multiple calls', async () => {
    mockGetVariable.mockResolvedValue(mockVariable());
    const path = '';
    await withExecution(() => vari.my.variable.id.test2.id());
    await withExecution(() => vari.my.variable.id.test2.id());
    expect(mockGetVariable).toHaveBeenCalledTimes(1);
  });
});

describe('vari.update', () => {
  it('fetches variable then calls updateVariable with its id and new value', async () => {
    mockGetVariable.mockResolvedValue(mockVariable({ id: 'var-uuid-123' }));
    mockUpdateVariable.mockResolvedValue({ id: 'var-uuid-123', value: 'new-value' });
    await withExecution(() => vari.my.variable.update.test1.update('new-value'));
    expect(mockUpdateVariable).toHaveBeenCalledWith('var-uuid-123', 'new-value', undefined);
  });

  it('passes expiresAt when provided', async () => {
    mockGetVariable.mockResolvedValue(mockVariable({ id: 'var-uuid-123' }));
    mockUpdateVariable.mockResolvedValue({});
    const expiresAt = '2030-01-01T00:00:00.000Z';
    await withExecution(() => vari.my.variable.update.test2.update('val', expiresAt));
    expect(mockUpdateVariable).toHaveBeenCalledWith('var-uuid-123', 'val', expiresAt);
  });

  it('returns the result of updateVariable', async () => {
    mockGetVariable.mockResolvedValue(mockVariable());
    const updated = { id: 'var-uuid-123', value: 'new-value' };
    mockUpdateVariable.mockResolvedValue(updated);
    const { data } = await withExecution(() => vari.my.variable.update.test3.update('new-value'));
    expect(data).toEqual(updated);
  });
});