const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),
  on: (channel, callback) => {
    const sub = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, sub);
    return () => ipcRenderer.removeListener(channel, sub);
  },
  send: (channel, data) => ipcRenderer.send(channel, data)
});

// Polyfill window.__TAURI_INTERNALS__ para retrocompatibilidade imediata com qualquer chamada tauriInvoke
contextBridge.exposeInMainWorld('__TAURI_INTERNALS__', {
  invoke: (cmd, args) => ipcRenderer.invoke(cmd, args)
});
