# PostPulse

A private Facebook post metrics dashboard built with React and TypeScript.
CSV files are parsed in the browser and are never uploaded to an application
database.

## Features

- Sample Facebook export loaded by default
- Local CSV replacement with validation feedback
- Sortable, filterable post table with proportional metric bars
- Separate, clickable multi-metric bar and line charts
- Date presets anchored to the latest post in the dataset
- Device-saved display preferences and configurable metric visibility
- Copyable titles, linked post cells, and responsive mobile post cards

## Development

Requires Node.js `>=22.13.0` and pnpm.

```bash
pnpm install
pnpm run dev
pnpm test
```

`pnpm test` performs a production build and runs the metric parser, filtering,
aggregation, edge-case, and rendered-shell checks.
