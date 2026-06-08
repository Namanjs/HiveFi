export const logger = {
  info: (message: string, extra?: any) => log('info', message, extra),
  warn: (message: string, extra?: any) => log('warn', message, extra),
  error: (message: string, extra?: any) => log('error', message, extra),
  debug: (message: string, extra?: any) => log('debug', message, extra),
};

function log(level: string, message: string, extra?: any) {
  const entry: any = { level, message, timestamp: new Date().toISOString() };
  if (extra) {
    if (extra instanceof Error) {
      entry.data = { message: extra.message, stack: extra.stack, name: extra.name };
    } else {
      entry.data = extra;
    }
  }
  process.stdout.write(JSON.stringify(entry) + '\n');
}
