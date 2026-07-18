import pino, { type LoggerOptions } from "pino";

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: process.env.SERVICE_NAME ?? "openvideo-web" },
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "req.headers.authorization",
      "req.headers.cookie",
      "*.apiKey",
      "*.secret",
    ],
    censor: "[REDACTED]",
  },
};

export const logger = pino(options);

export function toErrorContext(error: unknown): { error: { name: string; message: string; stack?: string } } {
  if (error instanceof Error) {
    return { error: { name: error.name, message: error.message, ...(error.stack ? { stack: error.stack } : {}) } };
  }
  return { error: { name: "UnknownError", message: String(error) } };
}
