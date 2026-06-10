import { _internal } from '../src/logs';
import { executeWithPolyCustom } from '../src/polyCustom';

const defaultPolyCustom = {
  executionId: 'test-exec-id',
  logsEnabled: true,
};

function withExecution<T>(fn: () => Promise<T>, overrides = {}) {
  return executeWithPolyCustom(
    fn as () => Promise<unknown>,
    { ...defaultPolyCustom, ...overrides },
  );
}

describe('logger', () => {
  let stdoutChunks: string[];
  let stderrChunks: string[];
  let originalStdoutWrite: typeof _internal.stdoutWrite;
  let originalStderrWrite: typeof _internal.stderrWrite;

  beforeEach(() => {
    stdoutChunks = [];
    stderrChunks = [];
    originalStdoutWrite = _internal.stdoutWrite;
    originalStderrWrite = _internal.stderrWrite;
    _internal.stdoutWrite = (chunk: any) => { stdoutChunks.push(chunk.toString()); return true; };
    _internal.stderrWrite = (chunk: any) => { stderrChunks.push(chunk.toString()); return true; };
  });

  afterEach(() => {
    _internal.stdoutWrite = originalStdoutWrite;
    _internal.stderrWrite = originalStderrWrite;
  });

  function getStdout() { return stdoutChunks.join(''); }
  function getStderr() { return stderrChunks.join(''); }

  describe('console patching', () => {
    it('prefixes log with executionId metadata', async () => {
      await withExecution(async () => { console.log('hello'); });
      expect(getStdout()).toContain('[LOG][META]executionId="test-exec-id"[/META]');
      expect(getStdout()).toContain('[/LOG]');
    });

    it('includes logRetentionGroup in metadata when set', async () => {
      await withExecution(async () => { console.log('hello'); }, { logRetentionGroup: 'my-group' });
      expect(getStdout()).toContain('logRetentionGroup="my-group"');
    });

    it('suppresses output when logsEnabled is false', async () => {
      await withExecution(async () => { console.log('hello'); }, { logsEnabled: false });
      expect(getStdout()).not.toContain('hello');
    });

    it('patches console.info', async () => {
      await withExecution(async () => { console.info('info message'); });
      expect(getStdout()).toContain('[INFO][META]');
      expect(getStdout()).toContain('[/INFO]');
    });

    it('patches console.warn', async () => {
      await withExecution(async () => { console.warn('warn message'); });
      expect(getStdout()).toContain('[WARN][META]');
    });

    it('patches console.error', async () => {
      await withExecution(async () => { console.error('error message'); });
      // Jest routes console.error through CustomConsole to stdout
      expect(getStdout()).toContain('[ERROR][META]');
    });

    it('reads executionId fresh per call not at patch time', async () => {
      await withExecution(async () => { console.log('from A'); }, { executionId: 'exec-A' });
      await withExecution(async () => { console.log('from B'); }, { executionId: 'exec-B' });
      expect(getStdout()).toContain('executionId="exec-A"');
      expect(getStdout()).toContain('executionId="exec-B"');
    });
  });

  describe('processOutput', () => {
    it('injects executionId into JSON output', async () => {
      await withExecution(async () => {
        const result = _internal.processOutput(JSON.stringify({ message: 'hello' }));
        const parsed = JSON.parse(result);
        expect(parsed.executionId).toBe('test-exec-id');
        expect(parsed.message).toBe('hello');
      });
    });

    it('leaves non-JSON output unchanged', async () => {
      await withExecution(async () => {
        expect(_internal.processOutput('plain text')).toBe('plain text');
      });
    });

    it('truncates output exceeding MAX_CHARS', async () => {
      await withExecution(async () => {
        const result = _internal.processOutput('x'.repeat(13_000));
        expect(result).toContain('[LOG TRUNCATED TO 12000 CHARACTERS. 1000 CHARACTERS NOT SHOWN.]');
      });
    });

    it('preserves leading and trailing whitespace', async () => {
      await withExecution(async () => {
        const result = _internal.processOutput('  hello  ');
        expect(result).toMatch(/^\s+hello\s+$/);
      });
    });

    it('handles stderr output', async () => {
      await withExecution(async () => {
        const result = _internal.processOutput(JSON.stringify({ error: 'oops' }));
        const parsed = JSON.parse(result);
        expect(parsed.executionId).toBe('test-exec-id');
        expect(parsed.error).toBe('oops');
      });
    });
  });

  describe('isolation', () => {
    it('each concurrent execution logs with its own executionId', async () => {
      await Promise.all([
        withExecution(async () => {
          await new Promise(r => setTimeout(r, 10));
          console.log('from A');
        }, { executionId: 'exec-A' }),
        withExecution(async () => {
          await new Promise(r => setTimeout(r, 10));
          console.log('from B');
        }, { executionId: 'exec-B' }),
      ]);
      expect(getStdout()).toContain('executionId="exec-A"');
      expect(getStdout()).toContain('executionId="exec-B"');
    });
  });
});