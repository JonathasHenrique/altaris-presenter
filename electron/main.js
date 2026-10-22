const { app, BrowserWindow, screen, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { startServer } = require('./server');

// Autoplay 100% automático no Chromium sem restrição de gesto
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies');

let mainWindow = null;
let audienceWindow = null;
let stageWindow = null;
let serverInstance = null;
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

function resolveHtmlPath(file) {
  if (isDev) {
    return file === 'index.html' ? 'http://localhost:5173' : `http://localhost:5173/${file}`;
  }
  // No build de produção, os arquivos HTML estão no mesmo diretório de electron-main.js (dist/)
  const candidate1 = path.join(__dirname, file);
  if (fs.existsSync(candidate1)) return `file://${candidate1}`;
  const candidate2 = path.join(__dirname, 'dist', file);
  if (fs.existsSync(candidate2)) return `file://${candidate2}`;
  return `file://${candidate1}`;
}

function resolvePreloadPath() {
  const candidate1 = path.join(__dirname, 'electron-preload.js');
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(__dirname, 'preload.js');
  if (fs.existsSync(candidate2)) return candidate2;
  return path.join(__dirname, 'dist', 'electron-preload.js');
}

function getDisplays() {
  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  return displays.map((d, i) => ({
    id: `display_${i}`,
    name: `Monitor ${i + 1} (${d.bounds.width}x${d.bounds.height})`,
    width: d.bounds.width,
    height: d.bounds.height,
    is_primary: d.id === primaryId
  }));
}

function toggleAudienceWindow(monitorIndex) {
  if (audienceWindow && !audienceWindow.isDestroyed()) {
    audienceWindow.close();
    audienceWindow = null;
    return false;
  }

  const displays = screen.getAllDisplays();
  let targetDisplay = displays[0];
  if (typeof monitorIndex === 'number' && displays[monitorIndex]) {
    targetDisplay = displays[monitorIndex];
  } else if (displays.length > 1) {
    targetDisplay = displays[1];
  }

  const hasMultiple = displays.length > 1;

  audienceWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: 960,
    height: 540,
    title: 'Altaris - Projeção',
    frame: !hasMultiple,
    fullscreen: hasMultiple,
    backgroundColor: '#000000',
    webPreferences: {
      preload: resolvePreloadPath(),
      webSecurity: false,
      contextIsolation: true
    }
  });

  audienceWindow.loadURL(resolveHtmlPath('audience.html'));
  audienceWindow.on('closed', () => { audienceWindow = null; });
  return true;
}

function toggleStageWindow(monitorIndex) {
  if (stageWindow && !stageWindow.isDestroyed()) {
    stageWindow.close();
    stageWindow = null;
    return false;
  }

  const displays = screen.getAllDisplays();
  let targetDisplay = displays[0];
  if (typeof monitorIndex === 'number' && displays[monitorIndex]) {
    targetDisplay = displays[monitorIndex];
  } else if (displays.length > 1) {
    targetDisplay = displays[1];
  }

  stageWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: 960,
    height: 540,
    title: 'Altaris - Retorno de Palco',
    backgroundColor: '#000000',
    webPreferences: {
      preload: resolvePreloadPath(),
      webSecurity: false,
      contextIsolation: true
    }
  });

  stageWindow.loadURL(resolveHtmlPath('stage.html'));
  stageWindow.on('closed', () => { stageWindow = null; });
  return true;
}

function setupIpcHandlers() {
  ipcMain.handle('get_displays', () => getDisplays());

  ipcMain.handle('server_info', () => serverInstance ? serverInstance.serverInfo : null);

  ipcMain.handle('toggle_audience_window', (_, args) => {
    const idx = args && typeof args.monitorIndex === 'number' ? args.monitorIndex : null;
    return toggleAudienceWindow(idx);
  });

  ipcMain.handle('toggle_stage_window', (_, args) => {
    const idx = args && typeof args.monitorIndex === 'number' ? args.monitorIndex : null;
    return toggleStageWindow(idx);
  });

  ipcMain.handle('open_browser_url', (_, { url }) => {
    if (url) shell.openExternal(url);
    return true;
  });

  ipcMain.handle('cache_presentation_file', async (_, { filename, data }) => {
    const tempDir = path.join(os.tmpdir(), 'altaris-presentations');
    fs.mkdirSync(tempDir, { recursive: true });
    const target = path.join(tempDir, filename);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    fs.writeFileSync(target, buf);
    return target;
  });

  ipcMain.handle('get_presentation_bytes', async (_, { filePath }) => {
    if (fs.existsSync(filePath)) {
      return Array.from(fs.readFileSync(filePath));
    }
    throw new Error('Arquivo não encontrado: ' + filePath);
  });

  ipcMain.handle('launch_libreoffice_presentation', async (_, { filePath, slideIndex }) => {
    const profileDir = path.join(os.tmpdir(), 'altaris-lo-profile');
    fs.mkdirSync(profileDir, { recursive: true });
    const profileUrl = `file://${profileDir.replace(/\\/g, '/')}`;

    const args = [
      `-env:UserInstallation=${profileUrl}`,
      '--nologo',
      '--norestore'
    ];
    if (slideIndex && slideIndex > 0) {
      args.push(`--show=${slideIndex}`);
    } else {
      args.push('--show');
    }
    args.push(filePath);

    const env = { ...process.env, SAL_USE_VCLPLUGIN: 'gtk3', SAL_DISABLE_OPENCL: '1', P11_KIT_DEBUG: 'none' };
    const child = spawn('soffice', args, { env, detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  });

  ipcMain.handle('convert_presentation_to_pdf', async (_, { filename, data }) => {
    const tempDir = path.join(os.tmpdir(), 'altaris-convert');
    fs.mkdirSync(tempDir, { recursive: true });
    const inPath = path.join(tempDir, filename);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    fs.writeFileSync(inPath, buf);

    return new Promise((resolve, reject) => {
      const child = spawn('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', tempDir, inPath]);
      child.on('close', (code) => {
        if (code === 0) {
          const outPdf = inPath.replace(/\.[^/.]+$/, '.pdf');
          if (fs.existsSync(outPdf)) {
            const pdfBytes = Array.from(fs.readFileSync(outPdf));
            resolve(pdfBytes);
            return;
          }
        }
        reject(new Error('Falha ao converter apresentação via LibreOffice'));
      });
      child.on('error', (err) => reject(err));
    });
  });

  ipcMain.handle('ensure_system_fonts', async () => {
    return 'Fontes verificadas nativamente.';
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Altaris - Centro de Controle',
    backgroundColor: '#0a0d14',
    webPreferences: {
      preload: resolvePreloadPath(),
      webSecurity: false,
      contextIsolation: true
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.close();
    if (stageWindow && !stageWindow.isDestroyed()) stageWindow.close();
  });
}

app.whenReady().then(async () => {
  const baseDir = path.join(__dirname, isDev ? '..' : '.');
  serverInstance = await startServer(baseDir, isDev);
  setupIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
