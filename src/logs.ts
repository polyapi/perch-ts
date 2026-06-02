import { polyCustom } from './polyCustom';

const patchConsoleMethodWithLoggerData = (method, logLevel) => {
  const metaData = polyCustom.logRetentionGroup
    ? `[${logLevel}][META]executionId="${polyCustom.executionId}",logRetentionGroup="${polyCustom.logRetentionGroup}"[/META]`
    : `[${logLevel}][META]executionId="${polyCustom.executionId}"[/META]`;

  const originalMethod = console[method];
  console[method] = function () {
    if (!polyCustom.logsEnabled) {
      return;
    }
    const args = Array.prototype.slice.call(arguments);
    args.unshift();
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
      const execId = polyCustom.executionId;

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

const originalStdoutWrite = process.stdout.write.bind(process.stdout);
// @ts-expect-error - it's fine
process.stdout.write = (chunk, encoding, callback) =>
  originalStdoutWrite(processOutput(chunk), encoding, callback);

const originalStderrWrite = process.stderr.write.bind(process.stderr);
// @ts-expect-error - it's fine
process.stderr.write = (chunk, encoding, callback) =>
  originalStderrWrite(processOutput(chunk), encoding, callback);
