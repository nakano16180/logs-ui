import { col, createTableSchema, type InferTableType } from '@/lib/table-schema'

export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export const logsTableSchema = createTableSchema({
  level: col.presets
    .logLevel(LOG_LEVELS)
    .description('Log severity: error > warn > info > debug')
    .size(80),
  timestamp: col.presets
    .timestamp()
    .label('Timestamp')
    .size(180)
    .sheet(),
  method: col.presets.httpMethod(HTTP_METHODS).size(80),
  path: col.presets.pathname().label('Path').size(220).sheet(),
  status: col.presets.httpStatus().label('Status').size(90),
  latency: col.presets
    .latency('ms')
    .label('Latency')
    .size(120)
    .sheet(),
  host: col
    .string()
    .label('Host')
    .filterable('input')
    .size(160)
    .sheet(),
  message: col
    .string()
    .label('Message')
    .filterable('input')
    .size(280)
    .sheet(),
  traceId: col.presets.traceId().label('Trace ID').hidden().sheet(),
})

export type LogRow = InferTableType<typeof logsTableSchema.definition>
