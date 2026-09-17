import { UploadError } from "./errors.ts";
import type { ClassifiedRegion, PersistedRegion, RegionToPersist } from "./types.ts";

type ProcessingStatus = "complete" | "partial_failure";
export type ClassifiedPage = {
  page_number: number;
  status: "classified";
  raster: { width: number; height: number };
  has_text_layer: boolean;
  text_processing: ProcessingStatus;
  table_processing: ProcessingStatus;
  diagram_processing: ProcessingStatus;
  regions: PersistedRegion[];
};
export type FailedPage = {
  page_number: number;
  status: "failed";
  error: string;
  error_code: string;
  retryable: boolean;
};
export type PageResult = ClassifiedPage | FailedPage;
export type PreparedPage = {
  raster: { width: number; height: number };
  hasTextLayer: boolean;
  classifications: ClassifiedRegion[];
  processed: RegionToPersist[];
};
export type RetrySession = {
  jobId?: string;
  bytes: Uint8Array | null;
  pageCount: number;
  pages: PageResult[];
  prepared: Map<number, PreparedPage>;
  expiresAt: number;
  busy: boolean;
  retries: number;
  retryNotBefore: number;
  failedInDatabase: boolean;
};

// Process-local, bounded temporary storage. Completed sessions keep response
// metadata only, allowing safe replay after a lost HTTP response.
export class RetrySessionStore {
  private readonly entries = new Set<RetrySession>();
  private readonly timers = new Map<RetrySession, ReturnType<typeof setTimeout>>();

  constructor(private readonly options: {
    ttlMs?: number; maxSessions?: number; maxBytes?: number; now?: () => number;
  } = {}) {}

  now(): number { return (this.options.now ?? Date.now)(); }

  reserve(bytes: Uint8Array, pageCount: number): RetrySession {
    this.purge();
    const used = [...this.entries].reduce((sum, entry) => sum + (entry.bytes?.byteLength ?? 0), 0);
    if (this.entries.size >= (this.options.maxSessions ?? 20) ||
        used + bytes.byteLength > (this.options.maxBytes ?? 64 * 1024 * 1024)) {
      throw new UploadError(503, "RETRY_CAPACITY_FULL", "The document service is busy. Please try again in a few minutes.");
    }
    const ttl = this.options.ttlMs ?? 15 * 60_000;
    const session: RetrySession = {
      bytes, pageCount, pages: [], prepared: new Map(), expiresAt: this.now() + ttl,
      busy: true, retries: 0, retryNotBefore: 0, failedInDatabase: false,
    };
    this.entries.add(session);
    const timer = setTimeout(() => { if (!session.busy) this.remove(session); }, ttl);
    timer.unref();
    this.timers.set(session, timer);
    return session;
  }

  get(jobId: string): RetrySession {
    this.purge();
    const session = [...this.entries].find((entry) => entry.jobId === jobId);
    if (!session) throw new UploadError(410, "RETRY_SESSION_EXPIRED",
      "The temporary PDF session has expired or is unavailable on this server. Saved results remain, but retrying now requires a new upload.");
    return session;
  }

  release(session: RetrySession): void {
    session.busy = false;
    if (session.pages.length === session.pageCount && session.pages.every((page) => page.status === "classified" || !page.retryable)) {
      session.bytes = null;
      session.prepared.clear();
    }
    if (session.expiresAt <= this.now()) this.remove(session);
  }

  remove(session: RetrySession): void {
    clearTimeout(this.timers.get(session));
    this.timers.delete(session);
    this.entries.delete(session);
    session.bytes = null;
    session.prepared.clear();
  }

  private purge(): void {
    for (const session of this.entries) {
      if (!session.busy && session.expiresAt <= this.now()) this.remove(session);
    }
  }
}
