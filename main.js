const { app, BrowserWindow, Tray, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');

const HOSTS_PATH = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
const MARKER_START = '# === BloqueadorPaginas START (no editar manualmente) ===';
const MARKER_END = '# === BloqueadorPaginas END ===';

const userDataDir = () => app.getPath('userData');
const settingsPath = () => path.join(userDataDir(), 'settings.json');

const DEFAULT_SETTINGS = {
  passwordHash: null,
  passwordSalt: null,
  useDefaultAdultList: true,
  customSites: [],
  autostart: true,
  setupComplete: false
};

let mainWindow = null;
let tray = null;
let cachedSettings = null;

function loadSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  return cachedSettings;
}

function saveSettings(settings) {
  cachedSettings = settings;
  fs.mkdirSync(userDataDir(), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function loadDefaultAdultList() {
  try {
    const listPath = path.join(__dirname, 'blocklists', 'adult-default.json');
    const raw = fs.readFileSync(listPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return [];
  }
}

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, useSalt, 64).toString('hex');
  return { hash, salt: useSalt };
}

function verifyPassword(password, settings) {
  if (!settings.passwordHash || !settings.passwordSalt) return false;
  const { hash } = hashPassword(password, settings.passwordSalt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(settings.passwordHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function buildDomainList(settings) {
  const domains = new Set();
  if (settings.useDefaultAdultList) {
    loadDefaultAdultList().forEach((d) => domains.add(d.toLowerCase().trim()));
  }
  (settings.customSites || []).forEach((d) => {
    const clean = d.toLowerCase().trim();
    if (clean) domains.add(clean);
  });
  return Array.from(domains);
}

function applyHostsBlocking(settings) {
  return new Promise((resolve, reject) => {
    let content = '';
    try {
      content = fs.readFileSync(HOSTS_PATH, 'utf8');
    } catch (err) {
      return reject(new Error('No se pudo leer el archivo hosts. ¿La aplicación se está ejecutando como administrador?'));
    }

    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + content.slice(endIdx + MARKER_END.length);
    }
    content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

    const domains = buildDomainList(settings);
    if (domains.length > 0) {
      const lines = [MARKER_START];
      domains.forEach((domain) => {
        lines.push(`127.0.0.1 ${domain}`);
        lines.push(`127.0.0.1 www.${domain}`);
      });
      lines.push(MARKER_END);
      content += '\n' + lines.join('\n') + '\n';
    }

    try {
      fs.writeFileSync(HOSTS_PATH, content, 'utf8');
    } catch (err) {
      return reject(new Error('No se pudo escribir el archivo hosts. Ejecuta la aplicación como administrador.'));
    }

    exec('ipconfig /flushdns', () => resolve());
  });
}

function removeHostsBlocking() {
  return new Promise((resolve, reject) => {
    let content = '';
    try {
      content = fs.readFileSync(HOSTS_PATH, 'utf8');
    } catch (err) {
      return reject(err);
    }
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      content = content.slice(0, startIdx) + content.slice(endIdx + MARKER_END.length);
    }
    content = content.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    try {
      fs.writeFileSync(HOSTS_PATH, content, 'utf8');
    } catch (err) {
      return reject(err);
    }
    exec('ipconfig /flushdns', () => resolve());
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  tray = new Tray(fs.existsSync(iconPath) ? iconPath : undefined);
  tray.setToolTip('Bloqueador de Páginas');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir panel',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: 'Salir',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(async () => {
  const settings = loadSettings();

  if (settings.setupComplete) {
    try {
      await applyHostsBlocking(settings);
    } catch (err) {
      dialog.showErrorBox('Bloqueador de Páginas', err.message);
    }
  }

  app.setLoginItemSettings({ openAtLogin: !!settings.autostart });

  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Mantener la app viva en la bandeja del sistema.
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// ---- IPC handlers ----

ipcMain.handle('get-state', () => {
  const settings = loadSettings();
  return {
    setupComplete: settings.setupComplete,
    useDefaultAdultList: settings.useDefaultAdultList,
    customSites: settings.customSites || [],
    autostart: settings.autostart
  };
});

ipcMain.handle('complete-setup', async (event, { password, useDefaultAdultList }) => {
  if (!password || password.length < 4) {
    return { ok: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }
  const { hash, salt } = hashPassword(password);
  const settings = {
    ...loadSettings(),
    passwordHash: hash,
    passwordSalt: salt,
    useDefaultAdultList: !!useDefaultAdultList,
    autostart: true,
    setupComplete: true
  };
  saveSettings(settings);
  app.setLoginItemSettings({ openAtLogin: true });
  try {
    await applyHostsBlocking(settings);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true };
});

ipcMain.handle('verify-password', (event, password) => {
  const settings = loadSettings();
  return verifyPassword(password, settings);
});

ipcMain.handle('change-password', (event, { currentPassword, newPassword }) => {
  const settings = loadSettings();
  if (!verifyPassword(currentPassword, settings)) {
    return { ok: false, error: 'La contraseña actual no es correcta.' };
  }
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 4 caracteres.' };
  }
  const { hash, salt } = hashPassword(newPassword);
  saveSettings({ ...settings, passwordHash: hash, passwordSalt: salt });
  return { ok: true };
});

ipcMain.handle('add-site', async (event, domain) => {
  const settings = loadSettings();
  const clean = String(domain || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!clean) return { ok: false, error: 'Dominio no válido.' };
  const sites = new Set(settings.customSites || []);
  sites.add(clean);
  const updated = { ...settings, customSites: Array.from(sites) };
  saveSettings(updated);
  try {
    await applyHostsBlocking(updated);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true, customSites: updated.customSites };
});

ipcMain.handle('remove-site', async (event, domain) => {
  const settings = loadSettings();
  const updated = {
    ...settings,
    customSites: (settings.customSites || []).filter((d) => d !== domain)
  };
  saveSettings(updated);
  try {
    await applyHostsBlocking(updated);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true, customSites: updated.customSites };
});

ipcMain.handle('toggle-default-list', async (event, enabled) => {
  const settings = loadSettings();
  const updated = { ...settings, useDefaultAdultList: !!enabled };
  saveSettings(updated);
  try {
    await applyHostsBlocking(updated);
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return { ok: true };
});

ipcMain.handle('set-autostart', (event, enabled) => {
  const settings = loadSettings();
  const updated = { ...settings, autostart: !!enabled };
  saveSettings(updated);
  app.setLoginItemSettings({ openAtLogin: !!enabled });
  return { ok: true };
});

ipcMain.handle('hide-window', () => {
  mainWindow.hide();
});
