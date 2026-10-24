---
name: verify
description: Run the full verification suite (build, types, lint, unit, e2e, prettier check) in a subagent and report PASS/FAIL with error excerpts. Use after code changes and before commits.
context: fork
agent: verify
---

Run the complete verification procedure for this repository and report the result. If `$ARGUMENTS`
names a package (for example `@ticketmanager/tickets-service`), restrict the Turbo run to that package.
