import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = (process.env.NODE_ENV === 'development' || !app.isPackaged) && process.env.NODE_ENV !== 'production' && process.env.ELECTRON_FORCE_PROD !== '1';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: 'Pose Coach',
    backgroundColor: '#0F251E',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Strict CSP and Media Permission Handling (Section A7, A10)
  const ses = session.defaultSession;
  
  ses.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    // Grant only media permission, only to local app origin
    const requestingUrl = details.requestingUrl || '';
    const isAppOrigin = requestingUrl.startsWith('http://localhost:5173') || 
                        requestingUrl.startsWith('file://');
    
    if (permission === 'media' && isAppOrigin) {
      callback(true);
    } else {
      console.warn(`[Security] Blocked unauthorized permission request: ${permission} from ${requestingUrl}`);
      callback(false);
    }
  });

  // Block top-level navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:5173') && !url.startsWith('file://')) {
      event.preventDefault();
      console.warn(`[Security] Blocked navigation attempt to: ${url}`);
    }
  });

  // Block window.open and target="_blank"
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    const loadDev = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        setTimeout(loadDev, 500);
      });
    };
    loadDev();
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

// App lifecycle
app.whenReady().then(() => {
  // IPC Handler for App Metrics (Section A7)
  ipcMain.handle('get-app-metrics', () => {
    return app.getAppMetrics();
  });

  // Direct snapshot persistence to user Downloads folder (eliminates Windows .tmp file download bug)
  ipcMain.handle('save-snapshot', async (_event, { base64Data, filename }: { base64Data: string; filename: string }) => {
    try {
      const downloadsPath = app.getPath('downloads');
      const safeFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const targetFile = safeFilename.endsWith('.png') ? safeFilename : `${safeFilename}.png`;
      const filePath = path.join(downloadsPath, targetFile);
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Image, 'base64');
      await fs.promises.writeFile(filePath, buffer);
      return { success: true, filePath, filename: targetFile };
    } catch (err: any) {
      console.error('[Electron IPC save-snapshot failed]', err);
      return { success: false, error: err.message };
    }
  });

  // Ensure any triggered downloads save to Downloads directory with real filename
  session.defaultSession.on('will-download', (_event, item) => {
    const downloadsPath = app.getPath('downloads');
    const filename = item.getFilename() || `DirectAI_Snapshot_${Date.now()}.png`;
    item.setSavePath(path.join(downloadsPath, filename));
  });

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
