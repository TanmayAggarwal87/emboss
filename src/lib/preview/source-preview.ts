import "server-only";
import { z } from "zod";

export type SourcePreview = { url?: string; expires_at?: string; error?: string };
type Entry = { bytes: Uint8Array; expiresAt: number; timer: ReturnType<typeof setTimeout> };

/** Temporary crops only: no PDF retention, disk writes, database or model access. */
export class SourcePreviewStore {
  private readonly entries = new Map<string, Entry>();
  private byteLength = 0;

  constructor(private readonly options: {
    ttlMs?: number; maxBytes?: number; maxEntries?: number; now?: () => number;
  } = {}) {}

  put(jobId: string, regionId: string, bytes: Uint8Array): SourcePreview {
    this.purge();
    const key = this.key(jobId, regionId);
    const existing = this.entries.get(key);
    if (existing) return this.metadata(jobId, regionId, existing.expiresAt);
    if (!bytes.byteLength || this.entries.size >= (this.options.maxEntries ?? 128) ||
        this.byteLength + bytes.byteLength > (this.options.maxBytes ?? 32 * 1024 * 1024)) {
      return { error: "The source preview could not be retained because temporary preview capacity is full. Generated results are still available." };
    }
    const ttl = this.options.ttlMs ?? 15 * 60_000;
    const expiresAt = this.now() + ttl;
    const timer = setTimeout(() => this.remove(key), ttl);
    timer.unref();
    const copy = Uint8Array.from(bytes);
    this.entries.set(key, { bytes: copy, expiresAt, timer });
    this.byteLength += copy.byteLength;
    return this.metadata(jobId, regionId, expiresAt);
  }

  get(jobId: string, regionId: string): Uint8Array | undefined {
    this.purge();
    const entry = this.entries.get(this.key(jobId, regionId));
    return entry ? Uint8Array.from(entry.bytes) : undefined;
  }

  private metadata(jobId: string, regionId: string, expiresAt: number): SourcePreview {
    return { url: `/api/jobs/${encodeURIComponent(jobId)}/regions/${encodeURIComponent(regionId)}/source`,
      expires_at: new Date(expiresAt).toISOString() };
  }
  private now() { return (this.options.now ?? Date.now)(); }
  private key(jobId: string, regionId: string) { return JSON.stringify([jobId, regionId]); }
  private remove(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.byteLength -= entry.bytes.byteLength;
    this.entries.delete(key);
  }
  private purge() {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= this.now()) this.remove(key);
  }
}

const shared = globalThis as typeof globalThis & { embossSourcePreviews?: SourcePreviewStore };
export function getSourcePreviewStore(): SourcePreviewStore {
  return shared.embossSourcePreviews ??= new SourcePreviewStore();
}

export function sourcePreviewResponse(store: SourcePreviewStore, jobId: string, regionId: string): Response {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin", "Referrer-Policy": "no-referrer" };
  if (!z.uuid().safeParse(jobId).success || !z.uuid().safeParse(regionId).success) {
    return Response.json({ error: { code: "INVALID_PREVIEW_ID", message: "Choose a valid source region." } }, { status: 400, headers });
  }
  const bytes = store.get(jobId, regionId);
  if (!bytes) return Response.json({ error: { code: "SOURCE_PREVIEW_EXPIRED",
    message: "The temporary source preview has expired or is unavailable on this server. Refer to your original PDF; saved geometry is unchanged." } }, { status: 410, headers });
  return new Response(Uint8Array.from(bytes), { headers: { ...headers, "Content-Type": "image/png" } });
}
