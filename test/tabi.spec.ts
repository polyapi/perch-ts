import { tabi } from '../src/tabi';
import { getTable, queryTable } from '../src/api';
import { executeWithPolyCustom } from '../src/polyCustom';

jest.mock('../src/api');

const mockGetTable = getTable as jest.MockedFunction<typeof getTable>;
const mockQueryTable = queryTable as jest.MockedFunction<typeof queryTable>;

const mockTable = { id: 'table-uuid-123', name: 'my table' };

const defaultPolyCustom = {
  executionId: 'test-exec',
  executionApiKey: 'test-key',
  baseUrl: 'http://poly-api.internal',
  polyApiVersion: '1',
};

function withExecution<T>(fn: () => Promise<T>) {
  return executeWithPolyCustom(fn as () => Promise<unknown>, defaultPolyCustom);
}

beforeEach(() => {
  mockGetTable.mockResolvedValue(mockTable);
});

describe('tabi.id', () => {
  it('fetches table and returns its id', async () => {
    const { data } = await withExecution(() => (tabi as any)['my.table.id.test1'].id());
    expect(mockGetTable).toHaveBeenCalledWith('my.table.id.test1');
    expect(data).toBe('table-uuid-123');
  });

  it('caches the table — only fetches once across multiple calls', async () => {
    await withExecution(() => tabi.my.table.id.test2.id());
    await withExecution(() => tabi.my.table.id.test2.id());
    expect(mockGetTable).toHaveBeenCalledTimes(1);
  });
});

describe('tabi.count', () => {
  it('calls queryTable with count type', async () => {
    mockQueryTable.mockResolvedValue({ count: 42 });
    const query = { where: { active: true } };
    const { data } = await withExecution(() => tabi.my.table.count(query));
    expect(mockQueryTable).toHaveBeenCalledWith('count', 'my.table', query);
    expect(data).toEqual({ count: 42 });
  });
});

describe('tabi.selectMany', () => {
  it('calls queryTable with select type', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const query = { where: {}, limit: 10 };
    await withExecution(() => tabi.my.table.selectMany(query));
    expect(mockQueryTable).toHaveBeenCalledWith('select', 'my.table', query);
  });

  it('defaults limit to 1000 if not set', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const query = { where: {} };
    await withExecution(() => tabi.my.table.selectMany(query));
    // @ts-expect-error - it's fine
    expect(query.limit).toBe(1000);
  });

  it('errors if limit exceeds 1000', async () => {
    const { error } = await withExecution(() => tabi.my.table.selectMany({ limit: 1001 }));
    expect(error?.message).toBe('Cannot select more than 1000 rows at a time.');
  });
});

describe('tabi.selectOne', () => {
  it('forces limit to 1 and returns first result', async () => {
    const row = { id: 1, name: 'Alice' };
    mockQueryTable.mockResolvedValue({ results: [row] });
    const query = { where: { id: 1 } };
    const { data } = await withExecution(() => tabi.my.table.selectOne(query));
    // @ts-expect-error - it's fine
    expect(query.limit).toBe(1);
    expect(mockQueryTable).toHaveBeenCalledWith('select', 'my.table', query);
    expect(data).toEqual(row);
  });

  it('returns null if no results', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const { data } = await withExecution(() => tabi.my.table.selectOne({ where: {} }));
    expect(data).toBeNull();
  });

  it('returns raw response if results is not an array', async () => {
    const errorRsp = { error: 'something went wrong' };
    mockQueryTable.mockResolvedValue(errorRsp);
    const { data } = await withExecution(() => tabi.my.table.selectOne({ where: {} }));
    expect(data).toEqual(errorRsp);
  });
});

describe('tabi.selectAll', () => {
  it('returns all rows across multiple pages', async () => {
    mockQueryTable
      .mockResolvedValueOnce({ results: [{ id: 1 }, { id: 2 }], pagination: { count: 2, pageSize: 2 } })
      .mockResolvedValueOnce({ results: [{ id: 3 }], pagination: { count: 1, pageSize: 2 } });

    const { data } = await withExecution(() => tabi.my.table.selectAll({ where: {} }));
    expect(mockQueryTable).toHaveBeenCalledTimes(2);
    expect(data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('defaults orderBy to id asc if not provided', async () => {
    mockQueryTable.mockResolvedValue({ results: [], pagination: { count: 0, pageSize: 1000 } });
    const query: any = { where: {} };
    await withExecution(() => tabi.my.table.selectAll(query));
    expect(query.orderBy).toEqual({ id: 'asc' });
  });

  it('preserves existing orderBy if provided', async () => {
    mockQueryTable.mockResolvedValue({ results: [], pagination: { count: 0, pageSize: 1000 } });
    const query: any = { where: {}, orderBy: { name: 'desc' } };
    await withExecution(() => tabi.my.table.selectAll(query));
    expect(query.orderBy).toEqual({ name: 'desc' });
  });

  it('stops paginating when count is less than pageSize', async () => {
    mockQueryTable.mockResolvedValue({ results: [{ id: 1 }], pagination: { count: 1, pageSize: 1000 } });
    await withExecution(() => tabi.my.table.selectAll({ where: {} }));
    expect(mockQueryTable).toHaveBeenCalledTimes(1);
  });
});

describe('tabi.insertMany', () => {
  it('calls queryTable with insert type', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const query = { data: [{ name: 'Alice' }] };
    await withExecution(() => tabi.my.table.insertMany(query));
    expect(mockQueryTable).toHaveBeenCalledWith('insert', 'my.table', query);
  });

  it('errors if data exceeds 1000 rows', async () => {
    const query = { data: Array(1001).fill({ name: 'x' }) };
    const { error } = await withExecution(() => tabi.my.table.insertMany(query));
    expect(error?.message).toBe('Cannot insert more than 1000 rows at a time.');
  });
});

describe('tabi.insertOne', () => {
  it('wraps data in array and returns first result', async () => {
    const row = { id: 1, name: 'Alice' };
    mockQueryTable.mockResolvedValue({ results: [row] });
    const query = { data: { name: 'Alice' } };
    const { data } = await withExecution(() => tabi.my.table.insertOne(query));
    expect(query.data).toEqual([{ name: 'Alice' }]);
    expect(mockQueryTable).toHaveBeenCalledWith('insert', 'my.table', query);
    expect(data).toEqual(row);
  });
});

describe('tabi.upsertMany', () => {
  it('calls queryTable with upsert type', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const query = { data: [{ id: 1, name: 'Alice' }] };
    await withExecution(() => tabi.my.table.upsertMany(query));
    expect(mockQueryTable).toHaveBeenCalledWith('upsert', 'my.table', query);
  });

  it('errors if data exceeds 1000 rows', async () => {
    const query = { data: Array(1001).fill({ name: 'x' }) };
    const { error } = await withExecution(() => tabi.my.table.upsertMany(query));
    expect(error?.message).toBe('Cannot upsert more than 1000 rows at a time.');
  });
});

describe('tabi.upsertOne', () => {
  it('wraps data in array and returns first result', async () => {
    const row = { id: 1, name: 'Alice' };
    mockQueryTable.mockResolvedValue({ results: [row] });
    const query = { data: { id: 1, name: 'Alice' } };
    const { data } = await withExecution(() => tabi.my.table.upsertOne(query));
    expect(query.data).toEqual([{ id: 1, name: 'Alice' }]);
    expect(data).toEqual(row);
  });
});

describe('tabi.updateMany', () => {
  it('calls queryTable with update type', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const query = { data: [{ id: 1, name: 'Bob' }] };
    await withExecution(() => tabi.my.table.updateMany(query));
    expect(mockQueryTable).toHaveBeenCalledWith('update', 'my.table', query);
  });
});

describe('tabi.updateOne', () => {
  it('adds id to where clause and returns first result', async () => {
    const row = { id: 5, name: 'Bob' };
    mockQueryTable.mockResolvedValue({ results: [row] });
    const query: any = { data: [{ name: 'Bob' }] };
    const { data } = await withExecution(() => tabi.my.table.updateOne(5, query));
    expect(query.where).toEqual({ id: 5 });
    expect(mockQueryTable).toHaveBeenCalledWith('update', 'my.table', query);
    expect(data).toEqual(row);
  });

  it('preserves existing where clause and adds id', async () => {
    mockQueryTable.mockResolvedValue({ results: [] });
    const query: any = { data: [], where: { active: true } };
    await withExecution(() => tabi.my.table.updateOne(5, query));
    expect(query.where).toEqual({ active: true, id: 5 });
  });
});

describe('tabi.deleteMany', () => {
  it('calls queryTable with delete type', async () => {
    mockQueryTable.mockResolvedValue({ deleted: 3 });
    const query = { where: { active: false } };
    await withExecution(() => tabi.my.table.deleteMany(query));
    expect(mockQueryTable).toHaveBeenCalledWith('delete', 'my.table', query);
  });
});

describe('tabi.deleteOne', () => {
  it('adds id to where clause and returns boolean deleted', async () => {
    mockQueryTable.mockResolvedValue({ deleted: 1 });
    const query: any = {};
    const { data } = await withExecution(() => tabi.my.table.deleteOne(5, query));
    expect(query.where).toEqual({ id: 5 });
    expect(mockQueryTable).toHaveBeenCalledWith('delete', 'my.table', query);
    expect(data).toEqual({ deleted: true });
  });

  it('returns deleted false when count is 0', async () => {
    mockQueryTable.mockResolvedValue({ deleted: 0 });
    const { data } = await withExecution(() => tabi.my.table.deleteOne(5, {}));
    expect(data).toEqual({ deleted: false });
  });

  it('returns raw response if deleted is not a number', async () => {
    const errorRsp = { error: 'not found' };
    mockQueryTable.mockResolvedValue(errorRsp);
    const { data } = await withExecution(() => tabi.my.table.deleteOne(5, {}));
    expect(data).toEqual(errorRsp);
  });

  it('preserves existing where clause and adds id', async () => {
    mockQueryTable.mockResolvedValue({ deleted: 1 });
    const query: any = { where: { tenantId: 'abc' } };
    await withExecution(() => tabi.my.table.deleteOne(5, query));
    expect(query.where).toEqual({ tenantId: 'abc', id: 5 });
  });
});