export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(verbose: boolean): Logger {
  const print = (level: string, message: string, context?: Record<string, unknown>): void => {
    if (level === "debug" && !verbose) {
      return;
    }

    const payload = context ? ` ${JSON.stringify(context)}` : "";
    process.stderr.write(`[${level.toUpperCase()}] ${message}${payload}\n`);
  };

  return {
    debug: (message, context) => print("debug", message, context),
    info: (message, context) => print("info", message, context),
    warn: (message, context) => print("warn", message, context),
    error: (message, context) => print("error", message, context)
  };
}
