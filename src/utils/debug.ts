
export type DebugLogger = (...args: unknown[]) => void;

// No-op logger for production — console.debug is a major perf bottleneck in RN
const noop: DebugLogger = () => {};

export const createDebugLogger = (scope: string): DebugLogger => {
  if (!__DEV__) return noop;
  return (...args: unknown[]) => {
    console.debug(`[${scope}]`, ...args);
  };
};