# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install
npm run dev      # vite dev server on http://localhost:5173
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm run preview  # serve dist/
```

There is no test runner configured.

## What this project is

The npm package is still called `logs-ui` for historical reasons, but the
app has been repurposed as an **OpenTelemetry-style trace viewer**. It runs
the [openstatushq/data-table-filters](https://github.com/openstatushq/data-table-filters)
registry blocks against a Next.js-free stack
([issue #14](https://github.com/openstatushq/data-table-filters/issues/14)),
and renders 200 deterministically-generated traces with faceted filters, a
stacked-bar timeline of trace counts by status (drag-to-zoom applies a
`startTime` filter), and a row-detail side sheet that shows a span
waterfall.

State adapter is **memory-only**. URL state (nuqs) and the React Query fetch
layer from the registry are intentionally not wired up — adding them means
swapping the adapter in `src/components/traces-table.tsx`, not rewriting it.

## Architecture

The data flow is one direction:

```
src/lib/traces-schema.ts — table schema (col.presets.* builders)
        │
        ▼
src/lib/table-schema/    — registry: turns a schema definition into
                           columns / filterFields / sheetFields / filterSchema
        │
        ▼
src/components/traces-table.tsx
   ├─ useMemoryAdapter(filterSchema) ← src/lib/store/adapters/memory
   ├─ DataTableStoreProvider          ← src/lib/store/provider
   ├─ chartSlot = TracesTimeline      (status × time stacked bar)
   ├─ sheetSlot = TraceSheetSlot      (TraceSummary + SpanWaterfall)
   └─ commandSlot = DataTableFilterCommand
        │
        ▼
src/components/data-table/  — registry blocks (do not rewrite from scratch)
```

`generateTraces()` returns `{ traces: TraceRow[], spansByTraceId: Record<string, Span[] }`.
The table only ever sees `TraceRow` (one row per trace); `spansByTraceId` is
threaded through `TracesTable` as a prop and looked up by the selected
trace's `traceId` when the sheet opens.

Things worth knowing before editing:

- `src/components/data-table/**`, `src/components/custom/**`,
  `src/components/ui/**`, `src/lib/table-schema/**`, `src/lib/store/**`,
  `src/lib/data-table/**`, `src/lib/table/**`, `src/lib/request/**`,
  `src/lib/constants/**`, and most small files in `src/lib/` (`colors.ts`,
  `compose-refs.ts`, `date-preset.ts`, `delimiters.ts`, `format.ts`,
  `is-array.ts`, `react-table.d.ts`) come from the **data-table-filters
  shadcn registry** (see `skills-lock.json`). Treat them as vendored: prefer
  re-pulling via the `data-table-filters` skill / `npx shadcn add` over hand
  edits, and re-apply the migration patches below after any re-pull.
- The app-specific code is small: `src/App.tsx`, `src/main.tsx`,
  `src/components/traces-table.tsx`, `src/components/traces-timeline.tsx`,
  `src/components/span-waterfall.tsx`, `src/lib/traces-schema.ts`,
  `src/lib/traces-data.ts`. Most product changes belong here.
- Schemas are declarative — `traces-schema.ts` composes
  `col.presets.logLevel` (repurposed for `'ok' | 'error'` status),
  `col.presets.timestamp`, `col.presets.latency`, `col.presets.traceId`,
  plus `col.string()` and `col.number().filterable('slider', …)`. Adding a
  column = adding one entry there; the generators in
  `src/lib/table-schema/generators/` derive everything else.
- `TracesTimeline` reaches into the table via `useDataTable()` and calls
  `table.getColumn('startTime').setFilterValue([Date, Date])` on
  drag-release. The column id `startTime` must stay aligned with
  `traces-schema.ts`.
- `SpanWaterfall` flattens the span tree by DFS (sorted by `startTime`
  per parent), then renders one row per span with `paddingLeft = depth *
  14px` and an absolutely-positioned bar whose `left` / `width` are
  percentages of `(traceEnd - traceStart)`. Errored spans use
  `var(--error)`; otherwise the bar color is a hash of the service name
  picked from `SERVICE_COLORS`.
- `generateTraces()` in `src/lib/traces-data.ts` uses a Mulberry32 PRNG
  seeded with `42` and an anchor of `Date.UTC(2026, 3, 28, 12, 0, 0)` so
  reloads show the same traces. Don't switch to `Math.random()`. Errors
  are injected by picking a random non-root span and propagating
  `status: 'error'` up the parent chain — that's why the trace's
  `errorCount` is always ≥ depth of the failed leaf.

## Vite-specific deltas vs. the Next.js registry

These four patches must be preserved whenever the registry is re-pulled,
otherwise the build breaks or behaves unexpectedly:

1. `src/components/data-table/data-table-infinite.tsx` — replace
   `process.env.NEXT_PUBLIC_TABLE_DEBUG` with
   `import.meta.env.VITE_TABLE_DEBUG`.
2. `tsconfig.app.json` — `verbatimModuleSyntax`, `noUnusedLocals`,
   `noUnusedParameters`, and `erasableSyntaxOnly` are intentionally **off**
   to match the registry's code style. Don't add them back.
3. `src/lib/request/status-code.ts` and `src/lib/data-table/faceted.ts` are
   not currently emitted by the registry; they were copied from the upstream
   repo's `packages/registry`. If the registry starts emitting them, prefer
   the upstream copy.
4. `src/components/data-table/data-table-infinite.tsx` — adds expandable-row
   support not present upstream: imports `getExpandedRowModel` and
   `ExpandedState`, holds an `expanded` state, wires `state.expanded` /
   `onExpandedChange` / `getExpandedRowModel: getExpandedRowModel()` into
   the `useReactTable` options, accepts a `renderSubComponent?: ({ row })
   => ReactNode` prop, renders `<TableRow><TableCell colSpan>...</TableCell>
   </TableRow>` after every row whose `getIsExpanded()` is true, and adds
   `expanded` to `Row`'s props + `MemoizedRow`'s comparator so the chevron
   re-renders on toggle. The `traces-table.tsx` consumer prepends a 36px
   `expand` column whose cell is a chevron `Button` that calls
   `row.toggleExpanded()` (with `event.stopPropagation()` so it doesn't
   double-fire row selection).

## Conventions

- Path alias `@/*` → `src/*` (configured in `vite.config.ts` and
  `tsconfig.app.json`). Use it consistently.
- Tailwind v4 via `@tailwindcss/vite`; design tokens live in `src/index.css`.
  shadcn config: `style: radix-nova`, `baseColor: neutral`, icon library
  `lucide` (see `components.json`).
- Some registry files start with `'use client'` / `'use no memo'` directives
  inherited from Next.js — they're harmless under Vite, leave them.
- ESLint is flat-config (`eslint.config.js`) with `typescript-eslint` +
  `react-hooks` + `react-refresh`. Run `npm run lint` before commits;
  `dist/` is globally ignored.
