'use client'
'use no memo'

import * as React from 'react'
import type { ColumnDef, Row } from '@tanstack/react-table'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { DataTableFilterCommand } from '@/components/data-table/data-table-filter-command'
import { DataTableInfinite } from '@/components/data-table/data-table-infinite'
import { useDataTable } from '@/components/data-table/data-table-provider'
import { DataTableSheetDetails } from '@/components/data-table/data-table-sheet/data-table-sheet-details'
import { SpanWaterfall } from '@/components/span-waterfall'
import { TracesTimeline } from '@/components/traces-timeline'
import { Button } from '@/components/ui/button'
import { useMemoryAdapter } from '@/lib/store/adapters/memory'
import { DataTableStoreProvider } from '@/lib/store/provider/DataTableStoreProvider'
import { field } from '@/lib/store/schema'
import {
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
  getDefaultColumnVisibility,
} from '@/lib/table-schema'
import type { Span } from '@/lib/traces-data'
import { tracesTableSchema, type TraceRow } from '@/lib/traces-schema'

const expandColumn: ColumnDef<TraceRow> = {
  id: 'expand',
  size: 36,
  enableSorting: false,
  enableHiding: false,
  header: () => null,
  cell: ({ row }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      aria-label={row.getIsExpanded() ? 'Collapse spans' : 'Expand spans'}
      onClick={(event) => {
        event.stopPropagation()
        row.toggleExpanded()
      }}
    >
      {row.getIsExpanded() ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-4 w-4" />
      )}
    </Button>
  ),
}

const TABLE_ID = 'traces'
const noop = () => Promise.resolve()
const noopRefetch = () => {}

export interface TracesTableProps {
  data: TraceRow[]
  spansByTraceId: Record<string, Span[]>
}

export function TracesTable({ data, spansByTraceId }: TracesTableProps) {
  const definition = tracesTableSchema.definition

  const columns = React.useMemo(
    () => [expandColumn, ...generateColumns<TraceRow>(definition)],
    [definition],
  )

  const renderSubComponent = React.useCallback(
    ({ row }: { row: Row<TraceRow> }) => (
      <SpanWaterfall spans={spansByTraceId[row.original.traceId]} />
    ),
    [spansByTraceId],
  )
  const filterFields = React.useMemo(
    () => generateFilterFields<TraceRow>(definition),
    [definition],
  )
  const defaultColumnVisibility = React.useMemo(
    () => getDefaultColumnVisibility(definition),
    [definition],
  )

  const filterSchema = React.useMemo(() => {
    const generated = generateFilterSchema(definition)
    return {
      ...generated,
      definition: { ...generated.definition, sort: field.sort() },
    }
  }, [definition])

  const adapter = useMemoryAdapter(filterSchema.definition, { id: TABLE_ID })

  return (
    <DataTableStoreProvider adapter={adapter}>
      <DataTableInfinite
        columns={columns}
        data={data}
        filterFields={filterFields}
        defaultColumnVisibility={defaultColumnVisibility}
        totalRowsFetched={data.length}
        totalRows={data.length}
        filterRows={data.length}
        hasNextPage={false}
        fetchNextPage={noop}
        refetch={noopRefetch}
        isFetching={false}
        isLoading={false}
        tableId={TABLE_ID}
        commandSlot={
          <DataTableFilterCommand
            schema={filterSchema.definition}
            tableId={TABLE_ID}
          />
        }
        chartSlot={<TracesTimeline data={data} />}
        sheetSlot={<TraceSheetSlot spansByTraceId={spansByTraceId} />}
        renderSubComponent={renderSubComponent}
      />
    </DataTableStoreProvider>
  )
}

function TraceSheetSlot({
  spansByTraceId,
}: {
  spansByTraceId: Record<string, Span[]>
}) {
  const { table, rowSelection, isLoading } = useDataTable<TraceRow, unknown>()
  const selectedRowKey = Object.keys(rowSelection)?.[0]
  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return undefined
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey)
  }, [selectedRowKey, isLoading, table])

  const trace = selectedRow?.original
  const spans = trace ? spansByTraceId[trace.traceId] : undefined

  return (
    <DataTableSheetDetails
      title={trace ? trace.rootName : ''}
      titleClassName="font-mono"
    >
      {trace ? (
        <div className="flex flex-col gap-4">
          <TraceSummary trace={trace} />
          <SpanWaterfall spans={spans} />
        </div>
      ) : null}
    </DataTableSheetDetails>
  )
}

function TraceSummary({ trace }: { trace: TraceRow }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <SummaryItem
        label="Trace ID"
        value={
          <code className="font-mono text-xs break-all">{trace.traceId}</code>
        }
      />
      <SummaryItem label="Root service" value={trace.rootService} />
      <SummaryItem label="Status" value={trace.status} />
      <SummaryItem label="Duration" value={`${trace.duration}ms`} />
      <SummaryItem label="Spans" value={trace.spanCount} />
      <SummaryItem label="Services" value={trace.serviceCount} />
      <SummaryItem label="Errors" value={trace.errorCount} />
      <SummaryItem label="Start" value={trace.startTime.toISOString()} />
    </dl>
  )
}

function SummaryItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  )
}
