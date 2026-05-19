import * as React from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { TracesTable } from '@/components/traces-table'
import { generateTraces } from '@/lib/traces-data'

function App() {
  const { traces, spansByTraceId } = React.useMemo(() => generateTraces(200), [])

  return (
    <TooltipProvider>
      <main className="min-h-svh flex flex-col gap-4 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">traces-ui</h1>
          <p className="text-muted-foreground text-sm">
            {traces.length} traces · OpenTelemetry-style waterfall
          </p>
        </header>
        <TracesTable data={traces} spansByTraceId={spansByTraceId} />
      </main>
    </TooltipProvider>
  )
}

export default App
