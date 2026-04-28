import { HTTP_METHODS, LOG_LEVELS, type LogRow } from '@/lib/logs-schema'

const HOSTS = ['api.logs-ui.dev', 'edge.logs-ui.dev', 'auth.logs-ui.dev']
const PATHS = [
  '/v1/users',
  '/v1/users/:id',
  '/v1/sessions',
  '/v1/billing/invoices',
  '/v1/projects',
  '/v1/projects/:id/logs',
  '/v1/health',
  '/v1/auth/login',
  '/v1/auth/refresh',
  '/v1/webhooks',
]
const STATUS_BY_LEVEL: Record<(typeof LOG_LEVELS)[number], number[]> = {
  error: [500, 502, 503, 504],
  warn: [400, 401, 403, 404, 422, 429],
  info: [200, 201, 204, 301, 302],
  debug: [200, 204],
}
const MESSAGES_BY_LEVEL: Record<(typeof LOG_LEVELS)[number], string[]> = {
  error: [
    'Upstream timeout while contacting downstream service',
    'Database connection pool exhausted',
    'Unhandled exception in request handler',
  ],
  warn: [
    'Request retried after transient failure',
    'Rate limit threshold approaching',
    'Deprecated endpoint accessed',
  ],
  info: [
    'Request handled successfully',
    'New session created',
    'Cache hit for resource',
  ],
  debug: [
    'Cache lookup completed',
    'Middleware chain executed',
    'Query plan resolved',
  ],
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

// Deterministic Mulberry32 PRNG so the demo data is stable across reloads
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomTraceId(rng: () => number): string {
  const hex = '0123456789abcdef'
  let id = ''
  for (let i = 0; i < 16; i++) id += hex[Math.floor(rng() * 16)]
  return id
}

export function generateLogs(count = 200, seed = 42): LogRow[] {
  const rng = mulberry32(seed)
  const now = Date.UTC(2026, 3, 28, 12, 0, 0)
  const rows: LogRow[] = []

  for (let i = 0; i < count; i++) {
    const level = pick(LOG_LEVELS, rng)
    // Latency distribution: error/warn skew slow, info/debug stay fast
    const baseLatency =
      level === 'error'
        ? 800 + rng() * 3500
        : level === 'warn'
          ? 200 + rng() * 1500
          : 20 + rng() * 400

    rows.push({
      level,
      timestamp: new Date(now - i * 60_000 - Math.floor(rng() * 30_000)),
      method: pick(HTTP_METHODS, rng),
      path: pick(PATHS, rng),
      status: pick(STATUS_BY_LEVEL[level], rng),
      latency: Math.round(baseLatency),
      host: pick(HOSTS, rng),
      message: pick(MESSAGES_BY_LEVEL[level], rng),
      traceId: randomTraceId(rng),
    })
  }

  return rows
}
