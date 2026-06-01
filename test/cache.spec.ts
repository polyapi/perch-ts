import { createCache, expireCache } from '../src/cache';

// Reset ALL_CACHES between tests by expiring everything
beforeEach(() => expireCache());

describe('createCache', () => {
  describe('get/set', () => {
    it('returns undefined for a missing key', () => {
      const cache = createCache('test');
      expect(cache.get('missing')).toBeUndefined();
    });

    it('returns a value that was set', () => {
      const cache = createCache('test');
      cache.set('key', 'value');
      expect(cache.get('key')).toBe('value');
    });

    it('stores any value type', () => {
      const cache = createCache('test');
      cache.set('num', 42);
      cache.set('obj', { a: 1 });
      cache.set('arr', [1, 2, 3]);
      cache.set('nil', null);
      cache.set('bool', false);
      expect(cache.get('num')).toBe(42);
      expect(cache.get('obj')).toEqual({ a: 1 });
      expect(cache.get('arr')).toEqual([1, 2, 3]);
      expect(cache.get('nil')).toBeNull();
      expect(cache.get('bool')).toBe(false);
    });

    it('overwrites an existing key', () => {
      const cache = createCache('test');
      cache.set('key', 'first');
      cache.set('key', 'second');
      expect(cache.get('key')).toBe('second');
    });
  });

  describe('named caches', () => {
    it('two caches with different names are independent', () => {
      const a = createCache('cache-a');
      const b = createCache('cache-b');
      a.set('key', 'value-a');
      expect(b.get('key')).toBeUndefined();
    });

    it('two caches with the same name share the same underlying map', () => {
      const a = createCache('shared');
      const b = createCache('shared');
      a.set('key', 'value');
      expect(b.get('key')).toBe('value');
    });
  });
});

describe('expireCache', () => {
  it('clears all caches when called with no arguments', () => {
    const a = createCache('expire-all-a');
    const b = createCache('expire-all-b');
    a.set('key', 'value');
    b.set('key', 'value');
    expireCache();
    expect(a.get('key')).toBeUndefined();
    expect(b.get('key')).toBeUndefined();
  });

  it('clears only the named cache when names are provided', () => {
    const a = createCache('expire-named-a');
    const b = createCache('expire-named-b');
    a.set('key', 'value');
    b.set('key', 'value');
    expireCache(['expire-named-a']);
    expect(a.get('key')).toBeUndefined();
    expect(b.get('key')).toBe('value');
  });

  it('clears only the specified path within a cache', () => {
    const cache = createCache('expire-path');
    cache.set('foo', 'foo-value');
    cache.set('bar', 'bar-value');
    expireCache(['expire-path'], ['foo']);
    expect(cache.get('foo')).toBeUndefined();
    expect(cache.get('bar')).toBe('bar-value');
  });

  it('clears specified paths across multiple named caches', () => {
    const a = createCache('expire-multi-a');
    const b = createCache('expire-multi-b');
    a.set('foo', 'value');
    a.set('bar', 'value');
    b.set('foo', 'value');
    b.set('bar', 'value');
    expireCache(['expire-multi-a', 'expire-multi-b'], ['foo']);
    expect(a.get('foo')).toBeUndefined();
    expect(a.get('bar')).toBe('value');
    expect(b.get('foo')).toBeUndefined();
    expect(b.get('bar')).toBe('value');
  });

  it('does nothing for an unknown cache name', () => {
    expect(() => expireCache(['does-not-exist'])).not.toThrow();
  });

  it('does nothing for an unknown path', () => {
    const cache = createCache('expire-unknown-path');
    cache.set('key', 'value');
    expireCache(['expire-unknown-path'], ['does-not-exist']);
    expect(cache.get('key')).toBe('value');
  });

  it('clears all paths in named cache when paths not provided', () => {
    const cache = createCache('expire-all-paths');
    cache.set('foo', 'value');
    cache.set('bar', 'value');
    expireCache(['expire-all-paths']);
    expect(cache.get('foo')).toBeUndefined();
    expect(cache.get('bar')).toBeUndefined();
  });
});