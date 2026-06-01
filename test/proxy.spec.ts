import { createProxy } from '../src/proxy';

describe('createProxy', () => {

  describe('factory validation', () => {
    it('throws if executer is not a function', () => {
      expect(() => createProxy('poly', [], 'not a function' as any))
        .toThrow('createProxy requires an executer function.');
    });

    it('creates a proxy without throwing for valid args', () => {
      expect(() => createProxy('poly', [], jest.fn())).not.toThrow();
    });
  });

  describe('path accumulation', () => {
    it('calls executer with dot-joined path on invocation', () => {
      const executer = jest.fn();
      const poly = createProxy('poly', [], executer);
      poly.foo.bar.baz();
      expect(executer).toHaveBeenCalledWith('foo.bar.baz', null);
    });

    it('passes args through to executer', () => {
      const executer = jest.fn();
      const poly = createProxy('poly', [], executer);
      poly.foo.bar('a', 'b', 123);
      expect(executer).toHaveBeenCalledWith('foo.bar', null, 'a', 'b', 123);
    });

    it('each traversal is independent', () => {
      const executer = jest.fn();
      const poly = createProxy('poly', [], executer);
      const base = poly.foo.bar;
      base.a();
      base.b();
      expect(executer).toHaveBeenCalledWith('foo.bar.a', null, );
      expect(executer).toHaveBeenCalledWith('foo.bar.b', null, );
    });

    it('throws if called with no path segments', () => {
      const poly = createProxy('poly', [], jest.fn());
      expect(() => (poly as any)()).toThrow("'poly' is not a function.");
    });
  });

  describe('terminators', () => {
    it('strips terminator from path and passes it separately', () => {
      const executer = jest.fn();
      const vari = createProxy('vari', ['get', 'set', 'delete'], executer);
      vari.foo.bar.get();
      expect(executer).toHaveBeenCalledWith('foo.bar', 'get');
    });

    it('passes args through with terminator', () => {
      const executer = jest.fn();
      const vari = createProxy('vari', ['get', 'set', 'delete'], executer);
      vari.foo.bar.set('value');
      expect(executer).toHaveBeenCalledWith('foo.bar', 'set', 'value');
    });

    it('throws if last segment is not a valid terminator', () => {
      const vari = createProxy('vari', ['get', 'set', 'delete'], jest.fn());
      expect(() => vari.foo.bar.put()).toThrow("'vari.foo.bar' is not a function.");
    });

    it('throws if called with no path before terminator', () => {
      const vari = createProxy('vari', ['get'], jest.fn());
      expect(() => (vari as any).get()).toThrow("'vari' is not a function.");
    });

    it('supports multiple different terminators on the same proxy', () => {
      const executer = jest.fn();
      const vari = createProxy('vari', ['get', 'set', 'delete'], executer);
      vari.foo.get();
      vari.foo.set('x');
      vari.foo.delete();
      expect(executer).toHaveBeenCalledWith('foo', 'get');
      expect(executer).toHaveBeenCalledWith('foo', 'set', 'x');
      expect(executer).toHaveBeenCalledWith('foo', 'delete');
    });
  });

  describe('debug/inspection', () => {
    it('toString returns proxy path representation', () => {
      const poly = createProxy('poly', [], jest.fn());
      expect(poly.foo.bar.toString()).toBe('[poly:foo.bar]');
    });

    it('valueOf returns proxy path representation', () => {
      const poly = createProxy('poly', [], jest.fn());
      expect(poly.foo.bar.valueOf()).toBe('[poly:foo.bar]');
    });

    it('toJSON returns proxy path representation', () => {
      const poly = createProxy('poly', [], jest.fn());
      expect(poly.foo.bar.toJSON()).toBe('[poly:foo.bar]');
    });

    it('toString on root proxy shows empty path', () => {
      const poly = createProxy('poly', [], jest.fn());
      expect(poly.toString()).toBe('[poly:]');
    });
  });

  describe('symbol properties', () => {
    it('returns undefined for symbol access', () => {
      const poly = createProxy('poly', [], jest.fn());
      expect((poly as any)[Symbol.iterator]).toBeUndefined();
      expect((poly as any)[Symbol.toPrimitive]).toBeUndefined();
    });
  });

  describe('executer return value', () => {
    it('returns the executer result', () => {
      const executer = jest.fn().mockReturnValue('result');
      const poly = createProxy('poly', [], executer);
      expect(poly.foo()).toBe('result');
    });

    it('propagates promise from executer', async () => {
      const executer = jest.fn().mockResolvedValue('async result');
      const poly = createProxy('poly', [], executer);
      await expect(poly.foo()).resolves.toBe('async result');
    });

    it('propagates rejection from executer', async () => {
      const executer = jest.fn().mockRejectedValue(new Error('boom'));
      const poly = createProxy('poly', [], executer);
      await expect(poly.foo()).rejects.toThrow('boom');
    });
  });

});