import * as React from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'
import { LogsTable } from '@/components/logs-table'
import { generateLogs } from '@/lib/logs-data'

function App() {
  const data = React.useMemo(() => generateLogs(200), [])

  return (
    <TooltipProvider>
      <main className="min-h-svh flex flex-col gap-4 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">logs-ui</h1>
          <p className="text-muted-foreground text-sm">
            {data.length} log entries · filterable, sortable, faceted
          </p>
        </header>
        <LogsTable data={data} />
      </main>
    </TooltipProvider>
  )
}

export default App
