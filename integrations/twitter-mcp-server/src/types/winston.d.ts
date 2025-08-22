declare module 'winston' {
  export interface LogEntry {
    level: string;
    message: string;
    timestamp?: string;
    [key: string]: any;
  }

  export interface Logger {
    log(level: string, message: string, meta?: any): Logger;
    error(message: string, meta?: any): Logger;
    warn(message: string, meta?: any): Logger;
    info(message: string, meta?: any): Logger;
    debug(message: string, meta?: any): Logger;
  }

  export interface TransportInstance {
    level?: string;
    silent?: boolean;
  }

  export interface FileTransportOptions {
    filename: string;
    level?: string;
  }

  export interface ConsoleTransportOptions {
    level?: string;
    format?: any;
  }

  export namespace transports {
    class File implements TransportInstance {
      constructor(options: FileTransportOptions);
    }
    class Console implements TransportInstance {
      constructor(options?: ConsoleTransportOptions);
    }
  }

  export namespace format {
    function combine(...formats: any[]): any;
    function timestamp(): any;
    function json(): any;
    function colorize(): any;
    function printf(fn: (info: LogEntry) => string): any;
  }

  export function createLogger(options: {
    level?: string;
    format?: any;
    defaultMeta?: Record<string, any>;
    transports?: TransportInstance[];
  }): Logger;
}
