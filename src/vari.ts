import { getVariable, getVariableValue, updateVariable } from './api';
import { createCache } from './cache';
import { createProxy } from './proxy';

const VARI_CACHE = createCache('vari');

async function getVariableFromCacheOrGateway(path: string) {
  let variable = VARI_CACHE.get(path);
  if (variable === undefined) {
    variable = await getVariable(path);
    VARI_CACHE.set(path, variable);
  }
  return variable;
}

export const vari = createProxy(
  'vari',
  ['get', 'inject', 'update', 'id'],
  (path, fn, ...args) => {
    if (fn === 'inject') {
      return {
        type: 'PolyVariable',
        pathIdentifier: path,
        subpath: args[0] || undefined,
      };
    }
    if (fn === 'get') {
      return getVariableFromCacheOrGateway(path).then((variable) => {
        if (variable.secrecy === 'SECRET') {
          throw new Error(
            'Cannot access secret variable from client. Use .inject() instead within Poly function.',
          );
        } else {
          return getVariableValue(variable.id);
        }
      });
    }
    if (fn === 'id') {
      return getVariableFromCacheOrGateway(path).then(
        (variable) => variable.id,
      );
    }
    if (fn === 'update') {
      const [value, expiresAt] = args;
      return getVariableFromCacheOrGateway(path)
        .then((variable) => updateVariable(variable.id, value, expiresAt));
    }
    return null;
  },
);
