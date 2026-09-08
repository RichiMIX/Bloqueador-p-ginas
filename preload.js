const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bloqueador', {
  getState: () => ipcRenderer.invoke('get-state'),
  completeSetup: (data) => ipcRenderer.invoke('complete-setup', data),
  verifyPassword: (password) => ipcRenderer.invoke('verify-password', password),
  changePassword: (data) => ipcRenderer.invoke('change-password', data),
  addSite: (domain) => ipcRenderer.invoke('add-site', domain),
  removeSite: (domain) => ipcRenderer.invoke('remove-site', domain),
  toggleDefaultList: (enabled) => ipcRenderer.invoke('toggle-default-list', enabled),
  setAutostart: (enabled) => ipcRenderer.invoke('set-autostart', enabled),
  hideWindow: () => ipcRenderer.invoke('hide-window')
});
