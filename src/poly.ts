import { getFunction, executeApiFunction, executeServerFunction } from './api';
import { createCache } from './cache';
import { createProxy } from './proxy';

const FN_CACHE = createCache();

async function getFunctionFromCacheOrGateway(path: string) {
  let fn = FN_CACHE.get(path);
  if (fn === undefined) {
    fn = await getFunction(path);
    FN_CACHE.set(path, fn);
  }
  return fn;
}

function executeClientFunction(fn, args) {
  // eslint-disable-next-line no-new-func
  const cfx = new Function(`${fn.code}\nreturn ${fn.name}`)();
  return cfx(...args);
}

async function executeFunction(path: string, fn: any, args: any[]) {
  if (fn.type === 'apiFunction') {
    const body = Object.fromEntries(
      fn.arguments.map((a, i) => [a.key, args[i]]),
    );
    return executeApiFunction(path, body);
  }
  if (fn.type === 'serverFunction') {
    const body = Object.fromEntries(
      fn.arguments.map((a, i) => [a.key, args[i]]),
    );
    return executeServerFunction(path, body);
  }
  if (fn.type === 'clientFunction') {
    return executeClientFunction(fn, args);
  }
  throw new Error(`Unknown function type for '${path}'`);
}

export const poly = createProxy('poly', [], (path, _fn, ...args) => {
  if (path.endsWith('.id')) return getFunctionFromCacheOrGateway(path).then((f) => f.id);
  return getFunctionFromCacheOrGateway(path).then((f) =>
    executeFunction(path, f, args),
  );
});
