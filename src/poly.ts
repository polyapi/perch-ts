import { createRequire } from 'node:module';
import vm from 'node:vm';
import { getFunction, getFunctionById, executeApiFunction, executeServerFunction } from './api';
import { createCache } from './cache';
import { polyCustom } from './polyCustom';
import { createProxy } from './proxy';
import { vari } from './vari';
import { tabi } from './tabi';

const moduleRequire = createRequire(__filename);

const FN_CACHE = createCache('poly');

async function getFunctionFromCacheOrGateway(path: string) {
  let fn = FN_CACHE.get(path);
  if (fn === undefined) {
    fn = await getFunction(path);
    FN_CACHE.set(path, fn);
  }
  return fn;
}

// Use symbols to cache the compiled function so that we don't ever clobber any values that might have been serialized on the function
const executeSymbol = Symbol('execute');

function executeLocalFunction(fn: any, args: any[]) {
  let cfx = fn[executeSymbol];
  if (!cfx) {
    const module = { exports: {} as any };
    const exports = module.exports;

    // Inject known dependencies directly rather than relying on require resolution
    const injectedRequire = (id: string) => {
      if (id === 'polyapi') return { polyCustom, poly, vari, tabi };
      return moduleRequire(id);
    };

    const wrapper = `(function(require, module, exports) { ${fn.code}\nreturn ${fn.name}; })`;
    const compiled = vm.runInThisContext(wrapper);
    cfx = compiled(injectedRequire, module, exports);

    cfx = cfx ?? module.exports[fn.name] ?? module.exports.default;
    if (typeof cfx !== 'function') {
      throw new Error(`Could not find exported function '${fn.name}' in function code.`);
    }
    fn[executeSymbol] = cfx;
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
    fn = await getFunctionById(id);
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
