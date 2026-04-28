'use client'
'use no memo'

import * as React from 'react'

import { DataTableFilterCommand } from '@/components/data-table/data-table-filter-command'
import { DataTableInfinite } from '@/components/data-table/data-table-infinite'
import { useDataTable } from '@/components/data-table/data-table-provider'
import { MemoizedDataTableSheetContent } from '@/components/data-table/data-table-sheet/data-table-sheet-content'
import { DataTableSheetDetails } from '@/components/data-table/data-table-sheet/data-table-sheet-details'
import { LogsTimeline } from '@/components/logs-timeline'
import { useMemoryAdapter } from '@/lib/store/adapters/memory'
import { DataTableStoreProvider } from '@/lib/store/provider/DataTableStoreProvider'
import { field } from '@/lib/store/schema'
import { logsTableSchema, type LogRow } from '@/lib/logs-schema'
import {
  generateColumns,
  generateFilterFields,
  generateFilterSchema,
  generateSheetFields,
  getDefaultColumnVisibility,
} from '@/lib/table-schema'

const TABLE_ID = 'logs'
const noop = () => Promise.resolve()
const noopRefetch = () => {}

export interface LogsTableProps {
  data: LogRow[]
}

export function LogsTable({ data }: LogsTableProps) {
  const definition = logsTableSchema.definition

  const columns = React.useMemo(
    () => generateColumns<LogRow>(definition),
    [definition],
  )
  const filterFields = React.useMemo(
    () => generateFilterFields<LogRow>(definition),
    [definition],
  )
  const sheetFields = React.useMemo(
    () => generateSheetFields<LogRow>(definition),
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
        chartSlot={<LogsTimeline data={data} />}
        sheetSlot={
          <LogsSheetSlot sheetFields={sheetFields} totalRows={data.length} />
        }
      />
    </DataTableStoreProvider>
  )
}

function LogsSheetSlot({
  sheetFields,
  totalRows,
}: {
  sheetFields: ReturnType<typeof generateSheetFields<LogRow>>
  totalRows: number
}) {
  const { table, rowSelection, isLoading, filterFields } = useDataTable<
    LogRow,
    unknown
  >()
  const selectedRowKey = Object.keys(rowSelection)?.[0]
  const selectedRow = React.useMemo(() => {
    if (isLoading && !selectedRowKey) return undefined
    return table
      .getCoreRowModel()
      .flatRows.find((row) => row.id === selectedRowKey)
  }, [selectedRowKey, isLoading, table])

  return (
    <DataTableSheetDetails
      title={selectedRow ? String(selectedRow.original.traceId ?? '') : ''}
      titleClassName="font-mono"
    >
      <MemoizedDataTableSheetContent
        table={table}
        data={selectedRow?.original}
        filterFields={filterFields}
        fields={sheetFields}
        metadata={{
          totalRows,
          filterRows: totalRows,
          totalRowsFetched: totalRows,
        }}
      />
    </DataTableSheetDetails>
  )
}
