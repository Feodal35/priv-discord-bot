export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  guildId?: string;
  userId?: string;
  command?: string;
  service?: string;
  [key: string]: any;
}

export class Logger {
  private formatPrefix(level: LogLevel, service?: string): string {
    const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
    const s = service ? `[${service}]` : '';
    switch (level) {
      case 'info':
        return `\x1b[36m[BİLGİ ${time}]${s}\x1b[0m`;
      case 'warn':
        return `\x1b[33m[UYARI ${time}]${s}\x1b[0m`;
      case 'error':
        return `\x1b[31m[HATA ${time}]${s}\x1b[0m`;
      case 'debug':
        return `\x1b[90m[DEBUG ${time}]${s}\x1b[0m`;
    }
  }

  public info(message: string, context?: LogContext): void {
    console.log(`${this.formatPrefix('info', context?.service)} ${message}`, context ? JSON.stringify(context) : '');
  }

  public warn(message: string, context?: LogContext): void {
    console.warn(`${this.formatPrefix('warn', context?.service)} ${message}`, context ? JSON.stringify(context) : '');
  }

  public error(message: string, error?: unknown, context?: LogContext): void {
    console.error(`${this.formatPrefix('error', context?.service)} ${message}`, error, context ? JSON.stringify(context) : '');
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${this.formatPrefix('debug', context?.service)} ${message}`, context ? JSON.stringify(context) : '');
    }
  }

  public command(commandName: string, userId: string, guildId?: string): void {
    this.info(`Komut çalıştırıldı: /${commandName}`, { command: commandName, userId, guildId });
  }
}

export const logger = new Logger();
