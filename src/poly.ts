import { getFunction, executeApiFunction, executeServerFunction } from './api';
import { createCache } from './cache';
import { polyCustom } from './polyCustom';
import { createProxy } from './proxy';

const FN_CACHE = createCache('poly');

async function getFunctionFromCacheOrGateway(path: string) {
  let fn = FN_CACHE.get(path);
  if (fn === undefined) {
    fn = await getFunction(path);
    FN_CACHE.set(path, fn);
  }
  return fn;
}

function executeLocalFunction(fn: any, args: any[]) {
  let cfx = fn.execute;
  if (!cfx) {
    // eslint-disable-next-line no-new-func
    cfx = new Function(`${fn.code}\nreturn ${fn.name}`)();
    fn.execute = cfx;
  }

  return cfx(...args);
}

async function executeFunction(path: string, fn: any, args: any[]) {
  if (fn.type === 'apiFunction') {
    const body = Object.fromEntries(
      fn.arguments.map((a, i) => [a.key, args[i]]),
    );
    return executeApiFunction(path, body).then(
      (data: { status: number; data: unknown }) => {
        if (
          data &&
          (data.status < 200 || data.status >= 300) &&
          polyCustom.logsEnabled
        ) {
          console.error(
            'Error executing api function with id:',
            fn.id,
            'Status code:',
            data.status,
            'Request data:',
            JSON.stringify(scrub(body)),
            'Response data:',
            JSON.stringify(data.data),
          );
        }
        return data;
      },
    );
  }
  if (fn.type === 'serverFunction') {
    const body = Object.fromEntries(
      fn.arguments.map((a, i) => [a.key, args[i]]),
    );
    return executeServerFunction(path, body);
  }
  if (fn.type === 'clientFunction') {
    return executeLocalFunction(fn, args);
  }
  throw new Error(`Unknown function type for '${path}'`);
}

export async function executeTopLevelServerFunction(id: string, args: any[]) {
  let fn = FN_CACHE.get(id);
  if (fn === undefined) {
    fn = await getFunction(id);
    FN_CACHE.set(id, fn);
  }
  return executeLocalFunction(fn, args);
}

export const poly = createProxy('poly', [], (path, _fn, ...args) => {
  if (path.endsWith('.id'))
    return getFunctionFromCacheOrGateway(path).then((f) => f.id);
  return getFunctionFromCacheOrGateway(path).then((f) =>
    executeFunction(path, f, args),
  );
});

const scrub = (data) => {
  if (!data || typeof data !== 'object') return data;
  const secrets = [
    'x_api_key',
    'x-api-key',
    'access_token',
    'access-token',
    'authorization',
    'api_key',
    'api-key',
    'apikey',
    'accesstoken',
    'token',
    'password',
    'key',
  ];
  if (Array.isArray(data)) {
    return data.map((item) => scrub(item));
  } else {
    const temp = {};
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'object') {
        temp[key] = scrub(data[key]);
      } else if (secrets.includes(key.toLowerCase())) {
        temp[key] = '********';
      } else {
        temp[key] = data[key];
      }
    }
    return temp;
  }
};
