'use client'
'use no memo'

import * as React from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceArea, XAxis } from 'recharts'
import { format } from 'date-fns'

type ChartMouseEvent = { activeLabel?: string | number } | undefined

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { useDataTable } from '@/components/data-table/data-table-provider'
import { cn } from '@/lib/utils'
import { LOG_LEVELS, type LogRow } from '@/lib/logs-schema'

type Bucket = { timestamp: number } & Record<(typeof LOG_LEVELS)[number], number>

const chartConfig = {
  error: { label: 'Error', color: 'var(--error)' },
  warn: { label: 'Warn', color: 'var(--warning)' },
  info: { label: 'Info', color: 'var(--info)' },
  debug: { label: 'Debug', color: 'var(--muted-foreground)' },
} satisfies ChartConfig

const TIMESTAMP_COLUMN_ID = 'timestamp'

function bucketLogs(rows: LogRow[], bucketCount = 60): Bucket[] {
  if (rows.length === 0) return []

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const r of rows) {
    const t = r.timestamp.getTime()
    if (t < min) min = t
    if (t > max) max = t
  }
  if (min === max) max = min + 1

  const span = max - min
  const bucketSize = span / bucketCount

  const buckets: Bucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    timestamp: Math.round(min + bucketSize * i),
    error: 0,
    warn: 0,
    info: 0,
    debug: 0,
  }))

  for (const r of rows) {
    const idx = Math.min(
      bucketCount - 1,
      Math.floor((r.timestamp.getTime() - min) / bucketSize),
    )
    buckets[idx][r.level]++
  }

  return buckets
}

function formatTick(value: string, period: Period): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (period === '10m') return format(date, 'HH:mm:ss')
  if (period === '1d') return format(date, 'HH:mm')
  if (period === '1w') return format(date, 'LLL dd HH:mm')
  return format(date, 'LLL dd, y')
}

type Period = '10m' | '1d' | '1w' | '1mo'
function periodFor(intervalMs: number): Period {
  if (intervalMs <= 1000 * 60 * 10) return '10m'
  if (intervalMs <= 1000 * 60 * 60 * 24) return '1d'
  if (intervalMs <= 1000 * 60 * 60 * 24 * 7) return '1w'
  return '1mo'
}

export interface LogsTimelineProps {
  data: LogRow[]
  className?: string
}

export function LogsTimeline({ data, className }: LogsTimelineProps) {
  const { table } = useDataTable<LogRow, unknown>()
  const [refLeft, setRefLeft] = React.useState<string | null>(null)
  const [refRight, setRefRight] = React.useState<string | null>(null)
  const [isSelecting, setIsSelecting] = React.useState(false)

  const buckets = React.useMemo(() => bucketLogs(data), [data])

  // Recharts' tooltip needs a string label to behave consistently
  const chart = React.useMemo(
    () =>
      buckets.map((b) => ({ ...b, [TIMESTAMP_COLUMN_ID]: new Date(b.timestamp).toString() })),
    [buckets],
  )

  const period: Period = React.useMemo(() => {
    if (buckets.length < 2) return '1d'
    return periodFor(
      Math.abs(buckets[buckets.length - 1].timestamp - buckets[0].timestamp),
    )
  }, [buckets])

  const handleMouseDown = (e: ChartMouseEvent) => {
    if (e?.activeLabel != null) {
      setRefLeft(String(e.activeLabel))
      setIsSelecting(true)
    }
  }

  const handleMouseMove = (e: ChartMouseEvent) => {
    if (isSelecting && e?.activeLabel != null) setRefRight(String(e.activeLabel))
  }

  const handleMouseUp = () => {
    if (refLeft && refRight && refLeft !== refRight) {
      const [left, right] = [refLeft, refRight].sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime(),
      )
      table
        .getColumn(TIMESTAMP_COLUMN_ID)
        ?.setFilterValue([new Date(left), new Date(right)])
    }
    setRefLeft(null)
    setRefRight(null)
    setIsSelecting(false)
  }

  if (buckets.length === 0) return null

  return (
    <ChartContainer
      config={chartConfig}
      className={cn(
        'aspect-auto h-[80px] w-full',
        '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50',
        'select-none',
        className,
      )}
    >
      <BarChart
        accessibilityLayer
        data={chart}
        margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: 'crosshair' }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey={TIMESTAMP_COLUMN_ID}
          tickLine={false}
          minTickGap={32}
          axisLine={false}
          tickFormatter={(value) => formatTick(value, period)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => {
                const date = new Date(value)
                if (Number.isNaN(date.getTime())) return ''
                return period === '10m'
                  ? format(date, 'LLL dd, HH:mm:ss')
                  : format(date, 'LLL dd, y HH:mm')
              }}
            />
          }
        />
        <Bar dataKey="error" stackId="a" fill="var(--color-error)" />
        <Bar dataKey="warn" stackId="a" fill="var(--color-warn)" />
        <Bar dataKey="info" stackId="a" fill="var(--color-info)" />
        <Bar dataKey="debug" stackId="a" fill="var(--color-debug)" />
        {refLeft && refRight && (
          <ReferenceArea
            x1={refLeft}
            x2={refRight}
            strokeOpacity={0.3}
            fill="var(--foreground)"
            fillOpacity={0.08}
          />
        )}
      </BarChart>
    </ChartContainer>
  )
}
