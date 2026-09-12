const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Stats
  getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
  getPingLatency: () => ipcRenderer.invoke('get-ping-latency'),
  getTopProcesses: () => ipcRenderer.invoke('get-top-processes'),
  getStartupApps: () => ipcRenderer.invoke('get-startup-apps'),
  getNvidiaInfo: () => ipcRenderer.invoke('get-nvidia-info'),
  openNvidiaControlPanel: () => ipcRenderer.invoke('open-nvidia-control-panel'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),

  // Actions
  applyTweak: (tweakId, payload) => ipcRenderer.invoke('apply-tweak', { tweakId, payload }),
  killProcess: (pid) => ipcRenderer.invoke('kill-process', pid),
  runSystemRepair: (type) => ipcRenderer.invoke('run-system-repair', type),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),

  // Event Listeners
  onLogUpdate: (callback) => ipcRenderer.on('log-update', (event, value) => callback(value)),
});
