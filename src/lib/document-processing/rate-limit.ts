export class UploadRateLimiter {
  private readonly requestCounts = new Map<string, number>();

  consume(ip: string, limit: number): boolean {
    const nextCount = (this.requestCounts.get(ip) ?? 0) + 1;
    this.requestCounts.set(ip, nextCount);
    return nextCount <= limit;
  }

  remaining(ip: string, limit: number): number {
    return Math.max(0, limit - (this.requestCounts.get(ip) ?? 0));
  }

  clear(): void {
    this.requestCounts.clear();
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return firstForwardedIp || request.headers.get("x-real-ip") || "unknown";
}
