const isProd = import.meta.env.PROD;

export const logger = {
  error: (...args: unknown[]) => { if (!isProd) console.error(...args); },
  warn: (...args: unknown[]) => { if (!isProd) console.warn(...args); },
  log: (...args: unknown[]) => { if (!isProd) console.log(...args); },
};
