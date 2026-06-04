import { col, createTableSchema, type InferTableType } from '@/lib/table-schema'

export const TRACE_STATUSES = ['ok', 'error'] as const
export const SPAN_KINDS = [
  'server',
  'client',
  'internal',
  'producer',
  'consumer',
] as const

export const tracesTableSchema = createTableSchema({
  status: col.presets
    .logLevel(TRACE_STATUSES)
    .label('Status')
    .description('Trace status — error if any span errored')
    .size(80),
  startTime: col.presets
    .timestamp()
    .label('Start')
    .size(180)
    .sheet(),
  rootName: col
    .string()
    .label('Operation')
    .filterable('input')
    .size(260)
    .sheet(),
  rootService: col
    .string()
    .label('Service')
    .filterable('input')
    .size(160)
    .sheet(),
  duration: col.presets
    .latency('ms', { min: 0, max: 10000 })
    .label('Duration')
    .size(140)
    .sheet(),
  spanCount: col
    .number()
    .label('Spans')
    .filterable('slider', { min: 0, max: 50 })
    .sortable()
    .size(90)
    .sheet(),
  serviceCount: col
    .number()
    .label('Services')
    .filterable('slider', { min: 0, max: 10 })
    .sortable()
    .size(100)
    .sheet(),
  errorCount: col
    .number()
    .label('Errors')
    .filterable('slider', { min: 0, max: 20 })
    .sortable()
    .size(90)
    .sheet(),
  traceId: col.presets.traceId().label('Trace ID').hidden().sheet(),
})

export type TraceRow = InferTableType<typeof tracesTableSchema.definition>
