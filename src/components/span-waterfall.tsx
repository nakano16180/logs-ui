import * as React from 'react'

import { cn } from '@/lib/utils'
import type { Span } from '@/lib/traces-data'

const SERVICE_COLORS = [
  'oklch(0.65 0.18 250)',
  'oklch(0.65 0.18 150)',
  'oklch(0.7 0.2 60)',
  'oklch(0.65 0.2 320)',
  'oklch(0.65 0.2 30)',
  'oklch(0.65 0.2 180)',
  'oklch(0.6 0.2 290)',
  'oklch(0.65 0.2 100)',
]

function colorForService(service: string): string {
  let hash = 0
  for (let i = 0; i < service.length; i++) {
    hash = (hash * 31 + service.charCodeAt(i)) | 0
  }
  return SERVICE_COLORS[Math.abs(hash) % SERVICE_COLORS.length]
}

interface FlatSpan {
  span: Span
  depth: number
}

function flattenSpans(spans: Span[]): FlatSpan[] {
  const byParent: Record<string, Span[]> = {}
  for (const s of spans) {
    const key = s.parentSpanId ?? '__root__'
    ;(byParent[key] ??= []).push(s)
  }
  for (const key in byParent) {
    byParent[key].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    )
  }

  const out: FlatSpan[] = []
  function visit(parentId: string, depth: number) {
    for (const child of byParent[parentId] ?? []) {
      out.push({ span: child, depth })
      visit(child.spanId, depth + 1)
    }
  }
  visit('__root__', 0)
  return out
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export interface SpanWaterfallProps {
  spans: Span[] | undefined
  className?: string
}

export function SpanWaterfall({ spans, className }: SpanWaterfallProps) {
  const flat = React.useMemo(
    () => (spans ? flattenSpans(spans) : []),
    [spans],
  )

  if (!spans || spans.length === 0) {
    return (
      <div className="text-muted-foreground text-sm">
        No spans available for this trace.
      </div>
    )
  }

  let traceStart = Number.POSITIVE_INFINITY
  let traceEnd = Number.NEGATIVE_INFINITY
  for (const s of spans) {
    const start = s.startTime.getTime()
    const end = start + s.duration
    if (start < traceStart) traceStart = start
    if (end > traceEnd) traceEnd = end
  }
  const totalMs = Math.max(1, traceEnd - traceStart)

  return (
    <div className={cn('flex flex-col gap-1 text-xs', className)}>
      <div className="text-muted-foreground flex items-center gap-2 border-b pb-1 font-mono">
        <div style={{ width: 220 }} />
        <div style={{ width: 100 }} />
        <div className="flex flex-1 justify-between">
          <span>0</span>
          <span>{formatDuration(totalMs / 2)}</span>
          <span>{formatDuration(totalMs)}</span>
        </div>
        <div style={{ width: 70 }} />
      </div>
      {flat.map(({ span, depth }) => {
        const offsetPct =
          ((span.startTime.getTime() - traceStart) / totalMs) * 100
        const widthPct = Math.max((span.duration / totalMs) * 100, 0.5)
        const color =
          span.status === 'error'
            ? 'var(--error)'
            : colorForService(span.service)
        return (
          <div
            key={span.spanId}
            className="hover:bg-muted/50 flex items-center gap-2 rounded py-1"
          >
            <div
              className="flex min-w-0 shrink-0 items-center gap-2"
              style={{ paddingLeft: depth * 14, width: 220 }}
            >
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span className="truncate font-mono" title={span.name}>
                {span.name}
              </span>
            </div>
            <span
              className="text-muted-foreground shrink-0 truncate text-[10px] uppercase"
              style={{ width: 100 }}
              title={span.service}
            >
              {span.service}
            </span>
            <div className="bg-muted relative h-4 flex-1 rounded">
              <div
                className="absolute h-full rounded"
                style={{
                  left: `${offsetPct}%`,
                  width: `${widthPct}%`,
                  background: color,
                }}
              />
            </div>
            <span
              className="text-muted-foreground shrink-0 text-right font-mono"
              style={{ width: 70 }}
            >
              {formatDuration(span.duration)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
