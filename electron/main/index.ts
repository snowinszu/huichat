import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { initDatabase } from './db/index.js';
import { registerIpcHandlers } from './ipc/register.js';
import { registerAvatarProtocol } from './avatarStorage.js';
import { isAppLocked } from './appLockState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build output layout:
// ├─┬─┬ dist                index.html (renderer)
// │ ├─┬ dist-electron
// │ │ ├─┬ main    → index.js (this file, built)
// │ │ └─┬ preload → index.js
process.env.APP_ROOT = path.join(__dirname, '../..');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

app.setName('会聊');

// E2E-only hook (electron/main/index.ts is otherwise oblivious to tests):
// pointing userData at a throwaway temp directory gives each test run its
// own SQLite DB and avatar folder, so the suite never touches — or gets
// polluted by — a real user's data. No-op unless the test runner sets it.
if (process.env.E2E_USER_DATA_DIR) {
  app.setPath('userData', process.env.E2E_USER_DATA_DIR);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    title: '会聊',
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // The lock overlay (rendered in the renderer, see AppLockProvider) covers
  // the content visually and makes it `inert`, but neither stops a reload —
  // a fresh page load would boot right past the overlay into unlocked
  // content. Reload/devtools are the only shortcuts that can do that, so
  // they're the only ones blocked here while locked; other shortcuts (copy,
  // zoom, etc.) can't reach the underlying content since it's `inert`.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isAppLocked() || input.type !== 'keyDown') return;
    const key = input.key.toLowerCase();
    const withModifier = input.meta || input.control;
    const isReload = (withModifier && key === 'r') || key === 'f5';
    const isDevTools = (withModifier && input.shift && key === 'i') || (withModifier && input.alt && key === 'i') || key === 'f12';
    if (isReload || isDevTools) event.preventDefault();
  });
}

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  registerAvatarProtocol();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
