type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: boolean;
  retryAfterMs?: number;
};

const rateLimitBuckets = new Map<string, number[]>();

export function getClientId(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

export function rateLimit({ key, limit, windowMs }: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  const bucket = rateLimitBuckets.get(key) || [];
  const active = bucket.filter((ts) => ts > windowStart);

  if (active.length >= limit) {
    const oldest = active[0];
    return {
      ok: false,
      retryAfterMs: Math.max(oldest + windowMs - now + 100, 0),
    };
  }

  active.push(now);
  rateLimitBuckets.set(key, active);
  return { ok: true };
}

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function requireAdmin(request: Request): { ok: boolean; status: number; message?: string } {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    return {
      ok: process.env.NODE_ENV !== 'production',
      status: process.env.NODE_ENV !== 'production' ? 200 : 503,
      message: 'Admin token not configured',
    };
  }

  const headerToken = request.headers.get('x-admin-token');
  const bearer = getBearerToken(request);
  const provided = headerToken || bearer;

  if (!provided || provided !== token) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return { ok: true, status: 200 };
}
