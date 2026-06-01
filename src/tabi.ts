import { getTable, queryTable } from './api';
import { createCache } from './cache';
import { createProxy } from './proxy';

const TABI_CACHE = createCache('tabi');

async function getTableFromCacheOrGateway(path: string) {
  let table = TABI_CACHE.get(path);
  if (table === undefined) {
    table = await getTable(path);
    TABI_CACHE.set(path, table);
  }
  return table;
}
const functions = [
  'id',
  'count',
  'selectOne',
  'selectMany',
  'selectAll',
  'updateOne',
  'updateMany',
  'insertMany',
  'insertOne',
  'upsertMany',
  'upsertOne',
  'deleteMany',
  'deleteOne',
];

function firstResult(rsp: any) {
  if (Array.isArray(rsp.results)) {
    return rsp?.results.length ? rsp.results[0] : null;
  }
  // Else rsp is some kind of error
  return rsp;
}

function deleteOneResponse(rsp: any) {
  if (typeof rsp.deleted === 'number') {
    return { deleted: rsp.deleted > 0 };
  }
  // Else rsp is some kind of error
  return rsp;
}

export const tabi = createProxy('poly', functions, (path, fn, ...args) => {
  if (fn === 'id')
    return getTableFromCacheOrGateway(path).then((table) => table.id);
  if (fn === 'count') return queryTable('count', path, args[0]);
  if (fn === 'selectMany') {
    const query = args[0];
    query.limit = query.limit || 1000;
    if (query.limit > 1000)
      throw Error(`Cannot select more than 1000 rows at a time.`);
    return queryTable('select', path, query);
  }
  if (fn === 'selectOne') {
    const query = args[0];
    query.limit = 1;
    return queryTable('select', path, query).then(firstResult);
  }
  if (fn === 'selectAll') {
    const query = args[0];
    return (async () => {
      const results: any[] = [];
      let result: any;
      let offset = 0;
      query.limit = query.limit || 1000;
      if (!query.orderBy || !Object.keys(query.orderBy).length) {
        query.orderBy = { id: 'asc' };
      }
      do {
        query.offset = offset;
        result = await queryTable('select', path, query);
        results.push(...result.results);
        offset += result!.pagination!.pageSize || 1000;
      } while (
        result &&
        result.pagination?.count &&
        result.pagination?.count === result.pagination.pageSize
      );
      return results;
    })();
  }
  if (fn === 'insertMany') {
    const query = args[0];
    if (query.data.length > 1000)
      throw Error(`Cannot insert more than 1000 rows at a time.`);
    return queryTable('insert', path, query);
  }
  if (fn === 'insertOne') {
    const query = args[0];
    query.data = [query.data];
    return queryTable('insert', path, query).then(firstResult);
  }
  if (fn === 'upsertMany') {
    const query = args[0];
    if (query.data.length > 1000)
      throw Error(`Cannot upsert more than 1000 rows at a time.`);
    return queryTable('upsert', path, query);
  }
  if (fn === 'upsertOne') {
    const query = args[0];
    query.data = [query.data];
    return queryTable('upsert', path, query).then(firstResult);
  }
  if (fn === 'updateMany') {
    const query = args[0];
    if (query.data.length > 1000)
      throw Error(`Cannot upsert more than 1000 rows at a time.`);
    return queryTable('update', path, query);
  }
  if (fn === 'updateOne') {
    const [id, query] = args;
    if (!query.where) query.where = {};
    query.where.id = id;
    return queryTable('update', path, query).then(firstResult);
  }
  if (fn === 'deleteMany') {
    const query = args[0];
    return queryTable('delete', path, query);
  }
  if (fn === 'deleteOne') {
    const [id, query] = args;
    if (!query.where) query.where = {};
    query.where.id = id;
    return queryTable('delete', path, query).then(deleteOneResponse);
  }
});
