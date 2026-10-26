# Load tests (k6)

See ADR 005. Scenarios in `scenarios/` (TypeScript, run by k6 itself), shared helpers in `lib/`.

```bash
cp tools/load/.env.example tools/load/.env   # fill LOADTEST_APP_ID / LOADTEST_APP_SECRET
pnpm load:smoke     # 1 VU, 30 s, every endpoint, strict thresholds (the gate)
pnpm load:read      # 50 VUs, cache-heavy reads on 200 seeded tickets
pnpm load:write     # 10 → 30 req/s of create + status change, end-to-end notification latency
pnpm load:stress    # 5 → 200 req/s mixed, exploratory
pnpm load:web       # anonymous home page, no credentials
pnpm load:clean     # rows left by the tests (add --mail to empty Mailpit)
LOAD_TARGET=docker pnpm load:smoke   # against the pnpm docker:up stack instead of pnpm dev
```

Extra k6 flags go after the scenario name: `pnpm load:read -- --duration 1m --vus 10`.
Results: the console summary, `results/<scenario>-<timestamp>.json`, and Grafana
(`Ticket Manager · k6 load tests`, filter `testid`). Every request carries a `traceparent`, so a
slow request is a trace in Tempo.
