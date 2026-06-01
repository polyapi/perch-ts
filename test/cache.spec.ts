import { createCache } from '../src/cache';
import { executeWithPolyCustom } from '../src/polyCustom';

describe('createCache', () => {

  describe('basic get/set', () => {
    it('returns undefined for a missing key', async () => {
      const cache = createCache(60_000);
      await executeWithPolyCustom(async () => {
        expect(cache.get('missing')).toBeUndefined();
      }, { executionId: 'exec-1' });
    });

    it('returns a value that was set', async () => {
      const cache = createCache(60_000);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
        expect(cache.get('key')).toBe('value');
      }, { executionId: 'exec-1' });
    });

    it('stores any value type', async () => {
      const cache = createCache(60_000);
      await executeWithPolyCustom(async () => {
        cache.set('num', 42);
        cache.set('obj', { a: 1 });
        cache.set('arr', [1, 2, 3]);
        cache.set('nil', null);
        expect(cache.get('num')).toBe(42);
        expect(cache.get('obj')).toEqual({ a: 1 });
        expect(cache.get('arr')).toEqual([1, 2, 3]);
        expect(cache.get('nil')).toBeNull();
      }, { executionId: 'exec-1' });
    });

    it('overwrites an existing key', async () => {
      const cache = createCache(60_000);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'first');
        cache.set('key', 'second');
        expect(cache.get('key')).toBe('second');
      }, { executionId: 'exec-1' });
    });
  });

  describe('TTL expiry', () => {
    it('returns value within TTL', async () => {
      const cache = createCache(60_000);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
        expect(cache.get('key')).toBe('value');
      }, { executionId: 'exec-1' });
    });

    it('returns undefined after TTL expires when read by a different execution', async () => {
      const cache = createCache(10);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
      }, { executionId: 'writer' });

      await new Promise(r => setTimeout(r, 20));

      await executeWithPolyCustom(async () => {
        expect(cache.get('key')).toBeUndefined();
      }, { executionId: 'reader' });
    });

    it('evicts the entry on expired read so subsequent reads also miss', async () => {
      const cache = createCache(10);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
      }, { executionId: 'writer' });

      await new Promise(r => setTimeout(r, 20));

      await executeWithPolyCustom(async () => {
        cache.get('key'); // triggers eviction
        expect(cache.get('key')).toBeUndefined();
      }, { executionId: 'reader' });
    });
  });

  describe('execution pinning', () => {
    it('keeps an expired entry alive for the execution that wrote it', async () => {
      const cache = createCache(10);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
        await new Promise(r => setTimeout(r, 20)); // outlast TTL
        expect(cache.get('key')).toBe('value');    // same execution — still alive
      }, { executionId: 'writer' });
    });

    it('does not serve an expired entry to a different execution', async () => {
      const cache = createCache(10);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
      }, { executionId: 'writer' });

      await new Promise(r => setTimeout(r, 20));

      await executeWithPolyCustom(async () => {
        expect(cache.get('key')).toBeUndefined();
      }, { executionId: 'reader' });
    });

    it('serves a non-expired entry to any execution', async () => {
      const cache = createCache(60_000);
      await executeWithPolyCustom(async () => {
        cache.set('key', 'value');
      }, { executionId: 'writer' });

      await executeWithPolyCustom(async () => {
        expect(cache.get('key')).toBe('value');
      }, { executionId: 'reader' });
    });

    it('two concurrent executions see their own pinned entries past TTL', async () => {
      const cache = createCache(10);

      await Promise.all([
        executeWithPolyCustom(async () => {
          cache.set('key-a', 'value-a');
          await new Promise(r => setTimeout(r, 20));
          expect(cache.get('key-a')).toBe('value-a');
        }, { executionId: 'exec-a' }),

        executeWithPolyCustom(async () => {
          cache.set('key-b', 'value-b');
          await new Promise(r => setTimeout(r, 20));
          expect(cache.get('key-b')).toBe('value-b');
        }, { executionId: 'exec-b' }),
      ]);
    });
  });

  describe('outside execution context', () => {
    it('set stores entry with undefined executionId', () => {
      const cache = createCache(60_000);
      // No executeWithPolyCustom wrapper — polyCustom.executionId is undefined
      expect(() => cache.set('key', 'value')).not.toThrow();
    });

    it('get returns value within TTL outside execution context', () => {
      const cache = createCache(60_000);
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
    });
  });

});