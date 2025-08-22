const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

class Logger {
  private level: number;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL?.toUpperCase() ||
      "INFO") as LogLevel;
    this.level = LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (LOG_LEVELS[level] <= this.level) {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level}]`;

      switch (level) {
        case "ERROR":
          console.error(prefix, message, ...args);
          break;
        case "WARN":
          console.warn(prefix, message, ...args);
          break;
        case "INFO":
          console.info(prefix, message, ...args);
          break;
        case "DEBUG":
          console.debug(prefix, message, ...args);
          break;
      }
    }
  }

  error(message: string, ...args: any[]): void {
    this.log("ERROR", message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log("WARN", message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log("INFO", message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.log("DEBUG", message, ...args);
  }
}

export const logger = new Logger();
