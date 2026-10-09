import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
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
