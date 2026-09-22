import { setTimeout as delay } from "node:timers/promises";

export type RetryBudget = { used: number };
export type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;
const BACKOFF_MS = [30_000, 90_000] as const;

export const sleep: Sleep = async (milliseconds, signal) => {
  await delay(milliseconds, undefined, { signal });
};

export function providerStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  return typeof error.status === "number" ? error.status : undefined;
}

export async function withProviderRetries<T>(
  generate: () => Promise<T>,
  budget: RetryBudget,
  options: { sleep?: Sleep; signal?: AbortSignal; onRetry?: (status: number, delayMs: number) => void } = {},
): Promise<T> {
  for (;;) {
    options.signal?.throwIfAborted();
    try {
      return await generate();
    } catch (error) {
      options.signal?.throwIfAborted();
      const status = providerStatus(error);
      if ((status !== 429 && status !== 503) || budget.used >= BACKOFF_MS.length) throw error;
      const delayMs = BACKOFF_MS[budget.used++];
      options.onRetry?.(status, delayMs);
      await (options.sleep ?? sleep)(delayMs, options.signal);
    }
  }
}
