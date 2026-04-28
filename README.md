# logs-ui

[openstatushq/data-table-filters][repo] を Vite + React で動かしてみるサンプル。

きっかけは [issue #14 "Create a Vite example"][issue] — 公式リポジトリは Next.js の参照アプリしか同梱されていないため、Vite + React 19 + Tailwind v4 のセットアップでも同じレジストリブロックが動くか試した。

[repo]: https://github.com/openstatushq/data-table-filters
[issue]: https://github.com/openstatushq/data-table-filters/issues/14

![overview](./docs/screenshots/overview.png)

## できるもの

API リクエストログ風のサンプル 200 件を、フィルター・ソート・行詳細サイドパネル・タイムラインチャート付きの data table で表示する。

- 左サイドバーの faceted filter (level / timestamp / method / path / status / latency / host / message)
- コマンドパレット風の検索バー
- 上部にスタックバーのタイムライン (error / warn / info / debug 別) — ドラッグで時間範囲フィルターを適用
- 行クリックで詳細サイドシート

![row detail](./docs/screenshots/row-detail.png)

## Tech stack

- Vite 8 + React 19 + TypeScript 6
- Tailwind CSS v4 (`@tailwindcss/vite`)
- shadcn/ui (Neutral palette / Nova preset)
- [data-table-filters][repo] レジストリブロック (core / schema / cell / sheet / filter-command)
- TanStack Table v8 + React Virtual + recharts + cmdk + date-fns

State adapter は **memory** のみ。URL state (nuqs) や React Query の fetch layer は未統合 — 必要なら同レジストリの `data-table-nuqs` / `data-table-query` ブロックを追加すれば乗る。

## Getting started

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build
```

## 移植のメモ (Next.js 前提コードからの差分)

公式レジストリは Vite でほぼそのまま動くが、以下の調整が必要だった:

- `data-table-infinite.tsx` の `process.env.NEXT_PUBLIC_TABLE_DEBUG` → `import.meta.env.VITE_TABLE_DEBUG`
- `tsconfig.app.json` から `verbatimModuleSyntax` / `noUnusedLocals` / `noUnusedParameters` / `erasableSyntaxOnly` を外した (レジストリのコードスタイルに合わせるため)
- 一部依存ファイル (`src/lib/request/status-code.ts`, `src/lib/data-table/faceted.ts`) が現時点のレジストリ配信では生成されないので、参照リポジトリの `packages/registry` から手動でコピー

## Project layout

```
src/
├─ App.tsx                   # TooltipProvider で LogsTable をラップ
├─ components/
│  ├─ logs-table.tsx         # DataTableInfinite + memory adapter のラッパ
│  ├─ logs-timeline.tsx      # recharts stacked bar + drag-to-zoom
│  ├─ data-table/            # data-table-filters レジストリブロック
│  └─ ui/                    # shadcn primitives
└─ lib/
   ├─ logs-schema.ts         # col.presets.* で組んだ table schema
   ├─ logs-data.ts           # 決定的サンプル log 生成 (Mulberry32)
   ├─ table-schema/          # data-table-schema レジストリ
   └─ store/                 # data-table BYOS adapter / hooks
```
