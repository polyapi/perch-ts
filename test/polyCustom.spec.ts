import { polyCustom, executeWithPolyCustom } from '../src/polyCustom';

describe('polyCustom', () => {

  describe('executeWithPolyCustom', () => {
    test('returns data from the function', async () => {
      const { data } = await executeWithPolyCustom(async () => 'hello', {});
      expect(data).toBe('hello');
    });

    test('returns final polyCustom state after execution', async () => {
      const { polyCustom: state } = await executeWithPolyCustom(async () => {
        polyCustom.responseStatusCode = 201;
        return null;
      }, { executionId: 'test-id' });

      expect(state.executionId).toBe('test-id');
      expect(state.responseStatusCode).toBe(201);
    });

    test('init values are readable via polyCustom inside the execution', async () => {
      await executeWithPolyCustom(async () => {
        expect(polyCustom.executionId).toBe('init-test');
        expect(polyCustom.executionApiKey).toBe('my-key');
      }, {
        executionId: 'init-test',
        executionApiKey: 'my-key',
      });
    });

    test('propagates rejection from the function', async () => {
      await expect(
        executeWithPolyCustom(async () => { throw new Error('boom'); }, {})
      ).rejects.toThrow('boom');
    });

    test('isolated between concurrent executions', async () => {
      const [runA, runB] = await Promise.all([
        executeWithPolyCustom(async () => {
          polyCustom.responseStatusCode = 404;
          polyCustom.responseHeaders = { 'x-custom-header': 'A' };
          await new Promise(r => setTimeout(r, 10));
          return 'A';
        }, { executionId: 'ABC' }),

        executeWithPolyCustom(async () => {
          polyCustom.responseStatusCode = 200;
          polyCustom.responseHeaders = { 'x-custom-header': 'B' };
          await new Promise(r => setTimeout(r, 10));
          return 'B';
        }, { executionId: 'DEF' }),
      ]);

      expect(runA.data).toBe('A');
      expect(runA.polyCustom.executionId).toBe('ABC');
      expect(runA.polyCustom.responseStatusCode).toBe(404);
      expect(runA.polyCustom.responseHeaders).toStrictEqual({ 'x-custom-header': 'A' });

      expect(runB.data).toBe('B');
      expect(runB.polyCustom.executionId).toBe('DEF');
      expect(runB.polyCustom.responseStatusCode).toBe(200);
      expect(runB.polyCustom.responseHeaders).toStrictEqual({ 'x-custom-header': 'B' });
    });

    test('isolated across sequential executions', async () => {
      await executeWithPolyCustom(async () => {
        polyCustom.responseStatusCode = 404;
      }, { executionId: 'first' });

      const { polyCustom: state } = await executeWithPolyCustom(async () => {
        return null;
      }, { executionId: 'second' });

      // Second execution should not see mutations from the first
      expect(state.executionId).toBe('second');
      expect(state.responseStatusCode).toBeUndefined();
    });

    test('context propagates through async gaps', async () => {
      const { polyCustom: state } = await executeWithPolyCustom(async () => {
        await new Promise(r => setTimeout(r, 10));
        polyCustom.responseStatusCode = 202;
        await new Promise(r => setTimeout(r, 10));
        return null;
      }, { executionId: 'async-test' });

      expect(state.executionId).toBe('async-test');
      expect(state.responseStatusCode).toBe(202);
    });

    test('nested executions are isolated from each other', async () => {
      const { polyCustom: outer } = await executeWithPolyCustom(async () => {
        polyCustom.responseStatusCode = 111;

        const { polyCustom: inner } = await executeWithPolyCustom(async () => {
          polyCustom.responseStatusCode = 999;
          return null;
        }, { executionId: 'inner' });

        expect(inner.responseStatusCode).toBe(999);
        // Outer context is unchanged after inner completes
        expect(polyCustom.responseStatusCode).toBe(111);
        return null;
      }, { executionId: 'outer' });

      expect(outer.responseStatusCode).toBe(111);
    });
  });

  describe('polyCustom proxy', () => {
    test('get returns undefined for unset properties outside execution', () => {
      expect(polyCustom.executionId).toBeUndefined();
    });

    test('set outside execution context does not throw', () => {
      expect(() => { polyCustom.responseStatusCode = 200; }).not.toThrow();
    });

    test('writes within execution are visible to subsequent reads in same execution', async () => {
      await executeWithPolyCustom(async () => {
        polyCustom.responseStatusCode = 302;
        expect(polyCustom.responseStatusCode).toBe(302);
        polyCustom.responseStatusCode = 200;
        expect(polyCustom.responseStatusCode).toBe(200);
      }, {});
    });

    test('mutations are reflected in returned polyCustom state', async () => {
      const { polyCustom: state } = await executeWithPolyCustom(async () => {
        polyCustom.responseHeaders = { 'x-foo': 'bar' };
        polyCustom.responseContentType = 'application/json';
        return null;
      }, {});

      expect(state.responseHeaders).toStrictEqual({ 'x-foo': 'bar' });
      expect(state.responseContentType).toBe('application/json');
    });
  });

});