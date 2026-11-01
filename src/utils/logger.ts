/**
 * Safe logger for MCP servers communicating over stdio.
 * All logs are written exclusively to process.stderr to prevent corrupting
 * the JSON-RPC messages on process.stdout.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (meta !== undefined) {
    const serializedMeta = typeof meta === 'object' ? JSON.stringify(meta) : String(meta);
    return `${prefix} ${message} ${serializedMeta}\n`;
  }
  return `${prefix} ${message}\n`;
}

export const logger = {
  debug: (message: string, meta?: unknown): void => {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      process.stderr.write(formatMessage('debug', message, meta));
    }
  },

  info: (message: string, meta?: unknown): void => {
    process.stderr.write(formatMessage('info', message, meta));
  },

  warn: (message: string, meta?: unknown): void => {
    process.stderr.write(formatMessage('warn', message, meta));
  },

  error: (message: string, meta?: unknown): void => {
    process.stderr.write(formatMessage('error', message, meta));
  },
};
