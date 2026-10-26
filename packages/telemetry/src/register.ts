/**
 * Preload entry point: `node --import @ticketmanager/telemetry/register dist/main.js`.
 * Must run before any application module is loaded: it installs the ESM loader hook the
 * instrumentations need (the official `auto-instrumentations-node/register` does not do it for
 * ES modules), reads `.env` for the telemetry variables, then starts the SDK.
 * The hook runs in-thread (`module.registerHooks`) on Node versions that support it, which is
 * the case of the project's Node 26; older runtimes fall back to the off-thread loader.
 */
import { register as registerAsyncLoader } from 'node:module';
import {
  register as registerSyncHooks,
  supportsSyncHooks,
} from 'import-in-the-middle/register-hooks.mjs';
import { loadDotEnv } from './env.js';
import { startTelemetry } from './sdk.js';

if (supportsSyncHooks()) {
  registerSyncHooks();
} else {
  registerAsyncLoader('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
}
loadDotEnv();
startTelemetry();
