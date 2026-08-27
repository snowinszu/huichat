import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// TEMPORARY — renderer-only dev server for local browser verification.
// Deleted after use. The real vite.config.ts wires vite-plugin-electron,
// which auto-launches the Electron binary on `vite dev`; Electron can't
// launch in this sandbox, so this strips that plugin to drive the plain
// React renderer with a mocked window.api instead.
export default defineConfig({
  plugins: [react()],
});
