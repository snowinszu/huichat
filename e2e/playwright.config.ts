import { defineConfig } from '@playwright/test';

// Electron E2E suite: each test drives the real, built app (see
// full-flow.spec.ts) via `_electron.launch`, so there's no `webServer` here
// to manage — the spec owns the Electron process's lifecycle itself.
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
});
