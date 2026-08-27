import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { initDatabase } from './db/index.js';
import { registerIpcHandlers } from './ipc/register.js';
import { registerAvatarProtocol } from './avatarStorage.js';

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
