const { app, BrowserWindow, screen, ipcMain, shell, Menu, MenuItem } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, spawnSync } = require("child_process");
const { startServer } = require("./server");

// Flatpak and container sandbox compatibility
if (process.env.FLATPAK_ID || process.env.container === "flatpak" || fs.existsSync("/.flatpak-info")) {
  app.commandLine.appendSwitch("no-sandbox");
  app.commandLine.appendSwitch("disable-gpu-sandbox");
  app.commandLine.appendSwitch("disable-setuid-sandbox");
}

// Autoplay 100% automático no Chromium sem restrição de gesto
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-features", "PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies");

let mainWindow = null;
let audienceWindow = null;
let stageWindow = null;
let serverInstance = null;
const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");

function getPresentationCacheDir(sub = "altaris-presentations") {
  // ~/.cache é compartilhado entre a sandbox Flatpak (--filesystem=home) e o LibreOffice do host
  const base = process.platform === "win32" ? os.tmpdir() : path.join(os.homedir(), ".cache");
  const dir = path.join(base, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function resolveSofficeExecutor() {
  const isFlatpak = Boolean(process.env.FLATPAK_ID || fs.existsSync("/.flatpak-info"));
  if (isFlatpak) {
    return {
      type: "flatpak",
      bin: "flatpak-spawn",
      prefixArgs: ["--host", "soffice"]
    };
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
      "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
      path.join(process.env.LOCALAPPDATA || "", "Programs", "LibreOffice", "program", "soffice.exe"),
      path.join(process.env.ProgramFiles || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"),
      path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe"),
      path.join(process.env.ProgramW6432 || "C:\\Program Files", "LibreOffice", "program", "soffice.exe")
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) return { type: "win32", bin: c, prefixArgs: [] };
    }
    try {
      const check = spawnSync("where.exe", ["soffice.exe"], { encoding: "utf8" });
      if (check.status === 0 && check.stdout) {
        const found = check.stdout.trim().split(/\r?\n/)[0];
        if (found && fs.existsSync(found)) {
          return { type: "win32", bin: found, prefixArgs: [] };
        }
      }
    } catch {}
    return { type: "win32", bin: "soffice.exe", prefixArgs: [], notFound: true };
  }

  // Linux / macOS (AppImage, local dev, pacote do sistema)
  const candidates = [
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
    "/usr/bin/libreoffice",
    "/usr/local/bin/libreoffice",
    "/bin/soffice",
    "/bin/libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/var/lib/flatpak/exports/bin/org.libreoffice.LibreOffice",
    path.join(os.homedir(), ".local/share/flatpak/exports/bin/org.libreoffice.LibreOffice")
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return { type: "native", bin: c, prefixArgs: [] };
  }
  try {
    const check = spawnSync("which", ["soffice"], { encoding: "utf8" });
    if (check.status === 0 && check.stdout) {
      const found = check.stdout.trim().split(/\r?\n/)[0];
      if (found && fs.existsSync(found)) {
        return { type: "native", bin: found, prefixArgs: [] };
      }
    }
  } catch {}
  return { type: "native", bin: "soffice", prefixArgs: [] };
}

function loadWindowPage(win, file) {
  if (isDev) {
    win.loadURL(file === "index.html" ? "http://localhost:5173" : `http://localhost:5173/${file}`);
  } else {
    const candidate1 = path.join(__dirname, file);
    if (fs.existsSync(candidate1)) return win.loadFile(candidate1);
    const candidate2 = path.join(__dirname, "dist", file);
    if (fs.existsSync(candidate2)) return win.loadFile(candidate2);
    const candidate3 = path.join(__dirname, "..", "dist", file);
    if (fs.existsSync(candidate3)) return win.loadFile(candidate3);
    return win.loadFile(candidate1);
  }
}

function resolvePreloadPath() {
  const candidate1 = path.join(__dirname, "electron-preload.js");
  if (fs.existsSync(candidate1)) return candidate1;
  const candidate2 = path.join(__dirname, "preload.js");
  if (fs.existsSync(candidate2)) return candidate2;
  return path.join(__dirname, "dist", "electron-preload.js");
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
  if (typeof monitorIndex === "number" && displays[monitorIndex]) {
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
    title: "Altaris - Projeção",
    frame: !hasMultiple,
    fullscreen: hasMultiple,
    backgroundColor: "#000000",
    webPreferences: {
      preload: resolvePreloadPath(),
      webSecurity: false,
      contextIsolation: true
    }
  });

  loadWindowPage(audienceWindow, "audience.html");
  audienceWindow.on("closed", () => { audienceWindow = null; });
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
  if (typeof monitorIndex === "number" && displays[monitorIndex]) {
    targetDisplay = displays[monitorIndex];
  } else if (displays.length > 1) {
    targetDisplay = displays[1];
  }

  stageWindow = new BrowserWindow({
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    width: 960,
    height: 540,
    title: "Altaris - Retorno de Palco",
    backgroundColor: "#000000",
    webPreferences: {
      preload: resolvePreloadPath(),
      webSecurity: false,
      contextIsolation: true
    }
  });

  loadWindowPage(stageWindow, "stage.html");
  stageWindow.on("closed", () => { stageWindow = null; });
  return true;
}

function setupIpcHandlers() {
  ipcMain.handle("get_displays", () => getDisplays());

  ipcMain.handle("server_info", () => serverInstance ? serverInstance.serverInfo : null);

  ipcMain.handle("toggle_audience_window", (_, args) => {
    const idx = args && typeof args.monitorIndex === "number" ? args.monitorIndex : null;
    return toggleAudienceWindow(idx);
  });

  ipcMain.handle("toggle_stage_window", (_, args) => {
    const idx = args && typeof args.monitorIndex === "number" ? args.monitorIndex : null;
    return toggleStageWindow(idx);
  });

  ipcMain.handle("open_browser_url", (_, { url }) => {
    if (url) shell.openExternal(url);
    return true;
  });

  ipcMain.handle("read_app_file", async (_, { relativePath }) => {
    const cleanRel = relativePath.replace(/^(\.\/|\/)/, "");
    const appBase = typeof app.getAppPath === "function" ? app.getAppPath() : __dirname;
    const candidatePaths = [
      path.join(appBase, cleanRel),
      path.join(appBase, "dist", cleanRel),
      path.join(appBase, "public", cleanRel),
      path.join(__dirname, cleanRel),
      path.join(__dirname, "dist", cleanRel),
      path.join(__dirname, "..", cleanRel),
      path.join(__dirname, "..", "public", cleanRel),
      path.join(process.resourcesPath || "", cleanRel),
      path.join(process.resourcesPath || "", "public", cleanRel),
      path.join(process.resourcesPath || "", "app.asar", cleanRel),
      path.join(process.resourcesPath || "", "app.asar", "dist", cleanRel),
      path.join(process.resourcesPath || "", "app.asar", "public", cleanRel)
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf8");
      }
    }
    throw new Error("Arquivo não encontrado: " + relativePath);
  });

  ipcMain.handle("cache_presentation_file", async (_, { filename, data }) => {
    const tempDir = getPresentationCacheDir("altaris-presentations");
    const target = path.join(tempDir, filename);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    fs.writeFileSync(target, buf);
    return target;
  });

  ipcMain.handle("get_presentation_bytes", async (_, { filePath }) => {
    if (fs.existsSync(filePath)) {
      return Array.from(fs.readFileSync(filePath));
    }
    throw new Error("Arquivo não encontrado: " + filePath);
  });

  ipcMain.handle("launch_libreoffice_presentation", async (_, { filePath, slideIndex }) => {
    try {
      const executor = resolveSofficeExecutor();
      if (executor.notFound) {
        return {
          success: false,
          error: "LibreOffice não foi detectado no sistema. Para exibir apresentações com transições nativas, instale o LibreOffice gratuito (https://www.libreoffice.org)."
        };
      }

      const profileDir = getPresentationCacheDir("altaris-lo-profile");
      const profileUrl = `file://${profileDir.replace(/\\/g, "/")}`;

      const runArgs = [
        ...executor.prefixArgs,
        `-env:UserInstallation=${profileUrl}`,
        "--nologo",
        "--norestore"
      ];
      if (slideIndex && slideIndex > 0) {
        runArgs.push(`--show=${slideIndex}`);
      } else {
        runArgs.push("--show");
      }
      runArgs.push(filePath);

      const env = { ...process.env, SAL_USE_VCLPLUGIN: "gtk3", SAL_DISABLE_OPENCL: "1", P11_KIT_DEBUG: "none" };
      return new Promise((resolve) => {
        let child;
        try {
          child = spawn(executor.bin, runArgs, { env, detached: true, stdio: "ignore" });
        } catch (e) {
          return resolve({ success: false, error: "Falha ao executar LibreOffice: " + (e.message || String(e)) });
        }

        child.on("error", (err) => {
          resolve({
            success: false,
            error: "LibreOffice não encontrado no sistema: " + err.message
          });
        });

        child.unref();
        setTimeout(() => {
          resolve({ success: true });
        }, 600);
      });
    } catch (err) {
      return { success: false, error: "Erro ao abrir apresentação: " + (err.message || String(err)) };
    }
  });

  ipcMain.handle("convert_presentation_to_pdf", async (_, { filename, data }) => {
    const executor = resolveSofficeExecutor();
    if (executor.notFound) {
      throw new Error("LibreOffice não foi detectado no computador. Instale o LibreOffice (https://www.libreoffice.org).");
    }

    const tempDir = getPresentationCacheDir("altaris-convert");
    const inPath = path.join(tempDir, filename);
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    fs.writeFileSync(inPath, buf);

    const profileDir = getPresentationCacheDir("altaris-lo-profile");
    const profileUrl = `file://${profileDir.replace(/\\/g, "/")}`;

    const runArgs = [
      ...executor.prefixArgs,
      `-env:UserInstallation=${profileUrl}`,
      "--headless",
      "--convert-to", "pdf:impress_pdf_Export",
      "--outdir", tempDir,
      inPath
    ];

    return new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn(executor.bin, runArgs);
      } catch (err) {
        return reject(new Error("LibreOffice não instalado: " + (err.message || String(err))));
      }

      child.on("error", (err) => {
        reject(new Error("LibreOffice não encontrado no sistema: " + err.message));
      });

      child.on("close", (code) => {
        if (code === 0) {
          const outPdf = inPath.replace(/\.[^/.]+$/, ".pdf");
          if (fs.existsSync(outPdf)) {
            const pdfBytes = Array.from(fs.readFileSync(outPdf));
            resolve(pdfBytes);
            return;
          }
        }
        reject(new Error(`Falha ao converter apresentação via LibreOffice (código ${code})`));
      });
    });
  });

  ipcMain.handle("ensure_system_fonts", async () => {
    return "Fontes verificadas nativamente.";
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: "Altaris - Centro de Controle",
    backgroundColor: "#0a0d14",
    webPreferences: {
      preload: resolvePreloadPath(),
      webSecurity: false,
      contextIsolation: true
    }
  });

  // Menu de edição invisível para garantir atalhos padrão (Ctrl+C, Ctrl+V, Ctrl+A, Ctrl+Z)
  const template = [
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Desfazer" },
        { role: "redo", label: "Refazer" },
        { type: "separator" },
        { role: "cut", label: "Recortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Colar" },
        { role: "selectAll", label: "Selecionar Tudo" }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.autoHideMenuBar = true;

  // Context Menu com botão direito em campos de texto
  mainWindow.webContents.on("context-menu", (_, params) => {
    if (params.isEditable) {
      const menu = new Menu();
      menu.append(new MenuItem({ role: "undo", label: "Desfazer" }));
      menu.append(new MenuItem({ role: "redo", label: "Refazer" }));
      menu.append(new MenuItem({ type: "separator" }));
      menu.append(new MenuItem({ role: "cut", label: "Recortar" }));
      menu.append(new MenuItem({ role: "copy", label: "Copiar" }));
      menu.append(new MenuItem({ role: "paste", label: "Colar" }));
      menu.append(new MenuItem({ role: "selectAll", label: "Selecionar Tudo" }));
      menu.popup();
    }
  });

  loadWindowPage(mainWindow, "index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (audienceWindow && !audienceWindow.isDestroyed()) audienceWindow.close();
    if (stageWindow && !stageWindow.isDestroyed()) stageWindow.close();
  });
}

app.whenReady().then(async () => {
  const baseDir = path.join(__dirname, isDev ? ".." : ".");
  serverInstance = await startServer(baseDir, isDev);
  setupIpcHandlers();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
