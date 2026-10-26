#!/usr/bin/env bash
# Runs one k6 scenario from the compose "k6" service: pnpm load:<scenario>  (smoke|read|write|stress|web)
# Results: console summary, tools/load/results/<scenario>-<timestamp>.json, Prometheus (dashboard
# "Ticket Manager · k6 load tests", filter by the testid printed below).
set -euo pipefail
scenario="${1:?usage: run.sh <scenario>}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
[ -f tools/load/.env ] || { echo "tools/load/.env missing: copy tools/load/.env.example and fill the ticketmanager-loadtest credentials" >&2; exit 1; }
mkdir -p tools/load/results && chmod a+rwx tools/load/results
testid="${scenario}-$(date +%Y%m%d-%H%M%S)"
echo "k6 ${scenario}  testid=${testid}  → Grafana: http://localhost:3030/d/tm-k6?var-testid=${testid}"
docker compose -f infra/docker-compose.yml run --rm k6 run \
  --tag "testid=${testid}" -o experimental-prometheus-rw "scenarios/${scenario}.ts" "${@:2}"
