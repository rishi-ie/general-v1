import { EventEmitter } from 'events';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
  ctx?: string;
  data?: Record<string, unknown>;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger extends EventEmitter {
  private minLevel: LogLevel;

  constructor(private ctx: string, minLevel: LogLevel = 'info') {
    super();
    this.minLevel = minLevel;
  }

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log('error', msg, data);
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      ts: Date.now(),
      level,
      msg,
      ctx: this.ctx,
      data,
    };

    const str = this.format(entry);
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(str);

    this.emit('entry', entry);
  }

  private format(entry: LogEntry): string {
    const iso = new Date(entry.ts).toISOString();
    const ctx = entry.ctx ? `[${entry.ctx}]` : '';
    const data = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
    return `${iso} ${entry.level.toUpperCase()} ${ctx} ${entry.msg}${data}`;
  }
}

export function createLogger(ctx: string): Logger {
  return new Logger(ctx);
}
