import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('pz', {
  config: { get: () => ipcRenderer.invoke('config:get'), detect: () => ipcRenderer.invoke('config:detect'), validate: (v) => ipcRenderer.invoke('config:validate', v), save: (v) => ipcRenderer.invoke('config:save', v) },
  dialog: { directory: () => ipcRenderer.invoke('dialog:directory') },
  server: { start: (v) => ipcRenderer.invoke('server:start', v), stop: () => ipcRenderer.invoke('server:stop'), status: () => ipcRenderer.invoke('server:status') },
  network: { profiles: () => ipcRenderer.invoke('network:profiles') },
  firewall: { add: (port) => ipcRenderer.invoke('firewall:add', port) },
  preview: { refresh: (v) => ipcRenderer.invoke('preview:refresh', v), open: (url) => ipcRenderer.invoke('preview:open', url) },
  window: { minimize: () => ipcRenderer.invoke('window:minimize'), toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'), close: () => ipcRenderer.invoke('window:close') },
})
