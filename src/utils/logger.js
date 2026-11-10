// Structured JSON-lines logger. Callers pass only non-sensitive metadata (never bodies, names, emails, URLs or keys).
const enabled = () => !(process.env.NODE_ENV === 'test' && !process.env.LOG_IN_TEST);
function write(level, event, meta = {}) {
  if (!enabled()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...meta });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}
module.exports = {
  info: (event, meta) => write('info', event, meta),
  warn: (event, meta) => write('warn', event, meta),
  error: (event, meta) => write('error', event, meta)
};
