
export function createProxy(
  name: string,
  functions: string[],
  executer: (path: string, terminator: string | null, ...args: any[]) => any,
): any {
  if (typeof executer !== 'function')
    throw new Error('createProxy requires an executer function.');

  const target = function () {};

  function buildProxy(pathParts: string[] = []) {
    return new Proxy(target, {
      get(_, prop) {
        if (typeof prop === 'symbol') return undefined;

        // Debug/inspection
        if (prop === 'toString' || prop === 'valueOf' || prop === 'toJSON') {
          return () => `[${name}:${pathParts.join('.')}]`;
        }

        return buildProxy([...pathParts, prop]);
      },

      apply(_, __, args) {
        let terminator: string | null = null;
        if (functions.length) {
          terminator = pathParts.pop() || null;
          if (!functions.includes(terminator))
            throw new Error(
              `'${name}.${pathParts.join('.')}' is not a function.`,
            );
        }
        if (pathParts.length === 0)
          throw new Error(`'${name}' is not a function.`);
        return executer(pathParts.join('.'), terminator, ...args);
      },
    });
  }

  return buildProxy([]) as any;
}
