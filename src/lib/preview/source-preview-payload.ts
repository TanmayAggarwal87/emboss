// Response/browser-only crop delivery. Never put these bytes in database rows.
export const MAX_INLINE_PREVIEW_CHARACTERS = 2 * 1024 * 1024;

type Preview = { url?: string; data_url?: string; expires_at?: string; error?: string };

export function boundSourcePreviews<T extends { source_preview?: Preview }>(
  regions: T[], budget: { remaining: number },
): T[] {
  return regions.map((region) => {
    const preview = region.source_preview;
    if (!preview?.data_url) return region;
    if (preview.data_url.length > budget.remaining) {
      return { ...region, source_preview: {
        error: "This source crop exceeds the temporary preview response limit. Refer to your original PDF; generated results are still available.",
      } };
    }
    budget.remaining -= preview.data_url.length;
    return region;
  });
}

export function resolveSourcePreviewUrl(preview: Preview | undefined, origin: string): string {
  if (preview?.data_url) {
    const prefix = "data:image/png;base64,";
    const encoded = preview.data_url.slice(prefix.length);
    if (preview.data_url.length > MAX_INLINE_PREVIEW_CHARACTERS ||
        !preview.data_url.startsWith(prefix) || !encoded.length || encoded.length % 4 !== 0 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
      throw new Error("The source preview image is invalid.");
    }
    return preview.data_url;
  }
  if (!preview?.url) throw new Error(preview?.error || "Source crop is not available for this region. Refer to your original PDF.");
  const url = new URL(preview.url, origin);
  if (url.origin !== origin) throw new Error("The source preview address is invalid.");
  return url.href;
}
