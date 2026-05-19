import {
  SPAN_KINDS,
  TRACE_STATUSES,
  type TraceRow,
} from '@/lib/traces-schema'

export interface Span {
  spanId: string
  parentSpanId: string | null
  traceId: string
  name: string
  service: string
  kind: (typeof SPAN_KINDS)[number]
  startTime: Date
  duration: number
  status: (typeof TRACE_STATUSES)[number]
  attributes: Record<string, string>
}

export interface TraceBundle {
  traces: TraceRow[]
  spansByTraceId: Record<string, Span[]>
}

const ROOT_OPERATIONS: { name: string; service: string }[] = [
  { name: 'GET /v1/users', service: 'api-gateway' },
  { name: 'POST /v1/sessions', service: 'auth' },
  { name: 'GET /v1/billing/invoices', service: 'billing' },
  { name: 'PUT /v1/projects/:id', service: 'api-gateway' },
  { name: 'POST /v1/webhooks/dispatch', service: 'notifier' },
  { name: 'GET /v1/health', service: 'api-gateway' },
  { name: 'DELETE /v1/projects/:id/logs', service: 'api-gateway' },
  { name: 'POST /v1/auth/refresh', service: 'auth' },
]

const CHILD_OPS_BY_SERVICE: Record<string, string[]> = {
  'api-gateway': ['routing.match', 'middleware.auth', 'middleware.ratelimit'],
  auth: ['jwt.verify', 'session.lookup', 'rbac.check'],
  users: ['users.fetch', 'users.serialize'],
  billing: ['stripe.invoices.list', 'invoices.aggregate'],
  postgres: [
    'SELECT users',
    'SELECT sessions',
    'SELECT invoices',
    'INSERT audit_log',
  ],
  redis: ['GET cache', 'SET cache', 'EXPIRE cache'],
  kafka: ['produce events.audit', 'produce events.notification'],
  notifier: ['email.send', 'slack.post'],
}

const DOWNSTREAM_SERVICES = [
  'auth',
  'users',
  'billing',
  'postgres',
  'redis',
  'kafka',
  'notifier',
]

const LEAF_SERVICES = ['postgres', 'redis', 'kafka']

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

function hex(n: number, rng: () => number): string {
  const chars = '0123456789abcdef'
  let s = ''
  for (let i = 0; i < n; i++) s += chars[Math.floor(rng() * 16)]
  return s
}

function buildSpans(
  rng: () => number,
  traceId: string,
  rootStartMs: number,
  rootDurationMs: number,
  rootName: string,
  rootService: string,
): Span[] {
  const rootSpanId = hex(8, rng)
  const spans: Span[] = [
    {
      spanId: rootSpanId,
      parentSpanId: null,
      traceId,
      name: rootName,
      service: rootService,
      kind: 'server',
      startTime: new Date(rootStartMs),
      duration: rootDurationMs,
      status: 'ok',
      attributes: {
        'http.method': pick(['GET', 'POST', 'PUT', 'DELETE'] as const, rng),
        'http.target': rootName.split(' ')[1] ?? '/',
      },
    },
  ]

  const childCount = 2 + Math.floor(rng() * 3) // 2-4 direct children
  const slot = rootDurationMs / Math.max(childCount, 1)

  for (let i = 0; i < childCount; i++) {
    const service = pick(
      DOWNSTREAM_SERVICES.filter((s) => s !== rootService),
      rng,
    )
    const ops = CHILD_OPS_BY_SERVICE[service] ?? ['op.run']
    const name = pick(ops, rng)

    // Sequential-ish layout: child i sits roughly in slot i, with jitter,
    // and stays inside the root span's window
    const offsetWithinRoot = Math.min(
      rootDurationMs - 1,
      i * slot + rng() * slot * 0.4,
    )
    const childMaxDuration = Math.max(
      1,
      rootDurationMs - offsetWithinRoot - 1,
    )
    const childDuration = Math.max(
      1,
      Math.min(childMaxDuration, 30 + rng() * (slot * 0.9)),
    )
    const childStart = rootStartMs + offsetWithinRoot
    const childSpanId = hex(8, rng)

    spans.push({
      spanId: childSpanId,
      parentSpanId: rootSpanId,
      traceId,
      name,
      service,
      kind: pick(['client', 'internal'] as const, rng),
      startTime: new Date(childStart),
      duration: childDuration,
      status: 'ok',
      attributes: {},
    })

    // Often add a leaf grandchild (DB/cache/queue call) inside the child
    if (rng() < 0.7 && childDuration > 20) {
      const leafService = pick(LEAF_SERVICES, rng)
      const leafOps = CHILD_OPS_BY_SERVICE[leafService] ?? ['db.query']
      const leafName = pick(leafOps, rng)
      const leafOffset = rng() * childDuration * 0.3
      const leafDuration = Math.max(
        1,
        Math.min(childDuration - leafOffset - 1, 5 + rng() * (childDuration * 0.6)),
      )

      spans.push({
        spanId: hex(8, rng),
        parentSpanId: childSpanId,
        traceId,
        name: leafName,
        service: leafService,
        kind: 'client',
        startTime: new Date(childStart + leafOffset),
        duration: leafDuration,
        status: 'ok',
        attributes: {},
      })
    }
  }

  return spans
}

function propagateError(spans: Span[], leafIdx: number) {
  const byId = new Map(spans.map((s) => [s.spanId, s]))
  let cur: Span | undefined = spans[leafIdx]
  while (cur) {
    cur.status = 'error'
    if (!cur.parentSpanId) break
    cur = byId.get(cur.parentSpanId)
  }
}

export function generateTraces(count = 200, seed = 42): TraceBundle {
  const rng = mulberry32(seed)
  const now = Date.UTC(2026, 3, 28, 12, 0, 0)
  const traces: TraceRow[] = []
  const spansByTraceId: Record<string, Span[]> = {}

  for (let i = 0; i < count; i++) {
    const traceId = hex(32, rng)
    const op = pick(ROOT_OPERATIONS, rng)
    const startMs = now - i * 60_000 - Math.floor(rng() * 30_000)

    // ~15% slow traces to give the duration filter / heatmap something to bite on
    const isSlow = rng() < 0.15
    const duration = Math.round(
      isSlow ? 1200 + rng() * 4500 : 60 + rng() * 700,
    )

    const spans = buildSpans(rng, traceId, startMs, duration, op.name, op.service)

    // ~18% of traces have an error in some leaf, propagated up the tree
    if (rng() < 0.18) {
      const leafIdx = 1 + Math.floor(rng() * (spans.length - 1))
      propagateError(spans, leafIdx)
    }

    const errorCount = spans.filter((s) => s.status === 'error').length
    const services = new Set(spans.map((s) => s.service))

    traces.push({
      traceId,
      rootName: op.name,
      rootService: op.service,
      status: errorCount > 0 ? 'error' : 'ok',
      startTime: new Date(startMs),
      duration,
      spanCount: spans.length,
      serviceCount: services.size,
      errorCount,
    })
    spansByTraceId[traceId] = spans
  }

  return { traces, spansByTraceId }
}
