import { polyCustom } from './polyCustom';

const patchConsoleMethodWithLoggerData = (method, logLevel) => {
  const originalMethod = console[method];
  console[method] = function (...args) {
    if (!polyCustom.logsEnabled) {
      return;
    }

    const metaData = polyCustom.logRetentionGroup
      ? `[${logLevel}][META]executionId="${polyCustom.executionId}",logRetentionGroup="${polyCustom.logRetentionGroup}"[/META]`
      : `[${logLevel}][META]executionId="${polyCustom.executionId}"[/META]`;

    originalMethod.apply(console, [metaData, ...args, `[/${logLevel}]`]);
  };
};

patchConsoleMethodWithLoggerData('log', 'LOG');
patchConsoleMethodWithLoggerData('info', 'INFO');
patchConsoleMethodWithLoggerData('error', 'ERROR');
patchConsoleMethodWithLoggerData('warn', 'WARN');

const MAX_CHARS = 12_000;

function processOutput(chunk) {
  let str = typeof chunk === 'string' ? chunk : chunk.toString();
  const leadingWhitespace = chunk.match(/^(\s*)/)?.[1] || '';
  const trailingWhitespace = chunk.match(/(\s*)$/)?.[1] || '';
  str = str.trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const obj = JSON.parse(str);
      // Hack to squash the default fastify request logging which we can't turn off without using a custom nodejs buildpack
      // Using 'level', 'pid', and 'node_version' keys to ensure we filter out other arbitrary object logs
      if (obj['level'] && obj['pid'] && obj['node_version'] && !obj['executionId']) return;
      obj.executionId = polyCustom.executionId;
      str = JSON.stringify(obj);
    } catch (e) {}
  }
  // Truncate output and add note for end users
  if (str.length > MAX_CHARS) {
    const len = str.length - MAX_CHARS;
    str =
      str.substring(0, MAX_CHARS) +
      `[LOG TRUNCATED TO ${MAX_CHARS} CHARACTERS. ${len} CHARACTERS NOT SHOWN.]`;
  }
  return `${leadingWhitespace}${str}${trailingWhitespace}`;
}

export const _internal = {
  stdoutWrite: process.stdout.write.bind(process.stdout),
  stderrWrite: process.stderr.write.bind(process.stderr),
  processOutput,
};

// @ts-expect-error - it's fine
process.stdout.write = (chunk, encoding, callback) =>
  _internal.stdoutWrite(processOutput(chunk), encoding, callback);

// @ts-expect-error - it's fine
process.stderr.write = (chunk, encoding, callback) =>
  _internal.stderrWrite(processOutput(chunk), encoding, callback);