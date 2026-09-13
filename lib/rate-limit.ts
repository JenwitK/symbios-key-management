type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Naive fixed-window rate limiter, in-memory and per-process only.
 *
 * TODO(production): this resets on every cold start and isn't shared across
 * serverless instances. Replace with a shared store (Upstash Redis, or a
 * Postgres table keyed by IP) before relying on it in production.
 */
export function isRateLimited(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > limit;
}
