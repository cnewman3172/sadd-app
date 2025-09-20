type Bucket = { count: number; resetAt: number; lastTs: number };
const buckets = new Map<string, Bucket>();

export function allowPing(key: string){
  const now = Date.now();
  const perMin = Number(process.env.RATE_LIMIT_PER_MINUTE || '60');
  const minInterval = Number(process.env.PING_MIN_INTERVAL_MS || '3000');
  const b = buckets.get(key) || { count: 0, resetAt: now + 60000, lastTs: 0 };
  if (now > b.resetAt){ b.count = 0; b.resetAt = now + 60000; }
  if (b.lastTs && (now - b.lastTs) < minInterval) return false;
  if (b.count >= perMin) return false;
  b.count += 1; b.lastTs = now; buckets.set(key, b);
  return true;
}

export function allowAuth(ip: string){
  const now = Date.now();
  const key = `auth:${ip}`;
  const perMin = Number(process.env.AUTH_RATE_LIMIT_PER_MIN || '20');
  const b = buckets.get(key) || { count: 0, resetAt: now + 60000, lastTs: 0 };
  if (now > b.resetAt){ b.count = 0; b.resetAt = now + 60000; }
  if (b.count >= perMin) return false;
  b.count += 1; b.lastTs = now; buckets.set(key, b);
  return true;
}

export function allow(key: string, perMin: number, minIntervalMs = 0){
  const now = Date.now();
  const b = buckets.get(key) || { count: 0, resetAt: now + 60000, lastTs: 0 };
  if (now > b.resetAt){ b.count = 0; b.resetAt = now + 60000; }
  if (minIntervalMs && b.lastTs && (now - b.lastTs) < minIntervalMs) return false;
  if (b.count >= perMin) return false;
  b.count += 1; b.lastTs = now; buckets.set(key, b);
  return true;
}
