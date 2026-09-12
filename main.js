const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const TweaksEngine = require('./tweaks-engine');
const { catalog, apps: optionalApps } = require('./tweak-catalog');
const { createCatalogEngine } = require('./catalog-engine');
let applyCatalog;
const powerOptions = require('./power-options');
const retiredCatalog = require('./retired-catalog');
const { createPowerEngine } = require('./power-engine');
let applyPower;
let tweakBusy = false;
let autoUpdater;
const updateStatus = { configured: false, state: 'Private build — no update server configured.', version: null, details: 'Updates stay disabled until a signed release feed is configured.' };

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    title: 'batmaniscool System Utility',
    backgroundColor: '#07090e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, 'assets/app-icon.png'),
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  initializeUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// An update configuration is produced only for a real release. Private builds
// never guess a URL or make background network requests.
function initializeUpdater() {
  const updateConfig = path.join(process.resourcesPath, 'app-update.yml');
  if (!app.isPackaged || !fs.existsSync(updateConfig)) return;
  try {
    ({ autoUpdater } = require('electron-updater'));
    updateStatus.configured = true;
    updateStatus.state = 'Ready to check for updates.';
    updateStatus.details = 'Updates are downloaded only after you choose to download them.';
    autoUpdater.autoDownload = false;
    autoUpdater.on('checking-for-update', () => updateStatus.state = 'Checking for updates…');
    autoUpdater.on('update-not-available', () => { updateStatus.state = 'You are up to date.'; updateStatus.version = null; });
    autoUpdater.on('update-available', info => { updateStatus.state = 'Update available.'; updateStatus.version = info.version; mainWindow?.webContents.send('update-status', {...updateStatus}); });
    autoUpdater.on('update-downloaded', () => { updateStatus.state = 'Update downloaded — restart to install.'; mainWindow?.webContents.send('update-status', {...updateStatus}); });
    autoUpdater.on('error', error => { updateStatus.state = 'Update check failed.'; updateStatus.details = error.message; });
  } catch (error) {
    updateStatus.state = 'Update service unavailable.';
    updateStatus.details = error.message;
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-system-stats', async () => {
  return await TweaksEngine.getSystemStats();
});

ipcMain.handle('get-nvidia-info', async () => {
  return await TweaksEngine.getNvidiaInfo();
});
ipcMain.handle('get-app-info', () => ({
  name: app.getName() || 'batmaniscool',
  version: app.getVersion(),
}));
ipcMain.handle('get-update-status', () => ({ ...updateStatus }));
ipcMain.handle('check-for-updates', async () => {
  if (!updateStatus.configured || !autoUpdater) return { ...updateStatus };
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    updateStatus.state = 'Update check failed.';
    updateStatus.details = error.message;
  }
  return { ...updateStatus };
});
ipcMain.handle('download-update', async () => {
  if (!autoUpdater || !updateStatus.configured) return { ...updateStatus };
  try { updateStatus.state = 'Downloading update…'; await autoUpdater.downloadUpdate(); }
  catch (error) { updateStatus.state = 'Update download failed.'; updateStatus.details = error.message; }
  return { ...updateStatus };
});
ipcMain.handle('install-update', () => {
  if (!autoUpdater || !updateStatus.configured) return { success: false, details: 'No configured update is ready.' };
  autoUpdater.quitAndInstall();
  return { success: true };
});

ipcMain.handle('open-nvidia-control-panel', async () => {
  return await new Promise(resolve => {
    execFile('nvcplui.exe', error => resolve({ success: !error, details: error ? 'NVIDIA Control Panel could not be opened. Confirm the NVIDIA driver and Control Panel are installed.' : 'Opened NVIDIA Control Panel.' }));
  });
});

ipcMain.handle('get-ping-latency', async () => {
  return await TweaksEngine.getPingLatency();
});

ipcMain.handle('get-top-processes', async () => {
  return await TweaksEngine.getTopProcesses();
});

ipcMain.handle('get-startup-apps', async () => {
  return await TweaksEngine.getStartupApps();
});
ipcMain.handle('get-driver-status', async () => TweaksEngine.getDriverStatus());
ipcMain.handle('get-network-diagnostics', async () => TweaksEngine.getNetworkDiagnostics());
ipcMain.handle('open-startup-settings', async () => {
  try { await shell.openExternal('ms-settings:startupapps'); return { success: true, details: 'Opened Windows Startup Apps settings.' }; }
  catch (error) { return { success: false, details: 'Windows Startup Apps settings could not be opened.' }; }
});

ipcMain.handle('kill-process', async (event, pid) => {
  return await TweaksEngine.killProcess(pid);
});

ipcMain.handle('run-system-repair', async (event, type) => {
  return await TweaksEngine.runSystemRepair(type);
});

ipcMain.handle('apply-tweak', async (event, { tweakId, payload = {} }) => {
  if (tweakBusy) return {success:false, action:tweakId, details:'Another change is still running. Try again when it finishes.'};
  tweakBusy = true;
  let result = { success: false, action: tweakId, details: 'Unknown action' };
  
  try {
    TweaksEngine.runPowerShell.lastFailure = null;
    const compatibility = await TweaksEngine.checkTweakCompatibility(tweakId);
    if (!compatibility.ok) {
      TweaksEngine.runPowerShell.lastFailure = null;
      result = { success: false, action: tweakId, details: compatibility.details };
    } else if (powerOptions.some(item => item.id === tweakId)) {
      applyPower ||= createPowerEngine(TweaksEngine.runPowerShell, path.join(app.getPath('userData'), 'power-backups'));
      result = await applyPower(tweakId, payload);
    } else if ([...catalog, ...retiredCatalog].some(item => item.id === tweakId)) {
      applyCatalog ||= createCatalogEngine(TweaksEngine.runPowerShell, path.join(app.getPath('userData'), 'registry-backups'));
      result = await applyCatalog(tweakId, payload);
    } else if (optionalApps.some(item => `debloat-${item.id}` === tweakId)) {
      result = await TweaksEngine.removeBloatApps(tweakId.slice(8));
    } else if (tweakId === 'verify-windows-files' || tweakId === 'check-component-store') {
      const res = await TweaksEngine.runPowerShell(tweakId === 'verify-windows-files' ? 'sfc /verifyonly' : 'DISM /Online /Cleanup-Image /CheckHealth');
      result = { success: res.success, action: tweakId === 'verify-windows-files' ? 'Verify Windows files' : 'Check component store', details: res.output || 'Windows check completed.' };
    } else {
    switch (tweakId) {
      case 'game-mode':
        result = await TweaksEngine.toggleGameMode(payload.enabled);
        break;
      case 'hags':
        result = await TweaksEngine.toggleHAGS(payload.enabled);
        break;
      case 'dynamic-tick':
        result = await TweaksEngine.toggleDynamicTick(payload.enabled);
        break;
      case 'power-throttling':
        result = await TweaksEngine.togglePowerThrottling(payload.enabled);
        break;
      case 'power-plan':
        result = await TweaksEngine.setPowerPlan(payload.plan);
        break;
      case 'optimize-ram':
        result = await TweaksEngine.optimizeRAM();
        break;
      case 'visual-fx':
        result = await TweaksEngine.toggleVisualFX(payload.enabled);
        break;
      case 'core-parking':
        result = await TweaksEngine.toggleCoreParking(payload.enabled);
        break;
      case 'paging-executive':
        result = await TweaksEngine.togglePagingExecutive(payload.enabled);
        break;
      case 'large-system-cache':
        result = await TweaksEngine.toggleLargeSystemCache(payload.enabled);
        break;
      case 'mouse-accel':
        result = await TweaksEngine.toggleMouseAcceleration(payload.enabled);
        break;
      case 'startup-delay':
        result = await TweaksEngine.toggleStartupDelay(payload.enabled);
        break;
      case 'sticky-keys':
        result = await TweaksEngine.toggleStickyKeys(payload.enabled);
        break;
      case 'game-dvr':
        result = await TweaksEngine.toggleGameDVR(payload.enabled);
        break;
      case 'network-throttling':
        result = await TweaksEngine.setNetworkThrottling(payload.enabled);
        break;
      case 'gaming-responsiveness':
        result = await TweaksEngine.toggleGamingSystemResponsiveness(payload.enabled);
        break;
      case 'usb-selective-suspend':
        result = await TweaksEngine.toggleUsbSelectiveSuspend(payload.enabled);
        break;
      case 'pcie-link-state':
        result = await TweaksEngine.togglePcieLinkState(payload.enabled);
        break;
      case 'processor-boost':
        result = await TweaksEngine.toggleProcessorBoost(payload.enabled);
        break;
      case 'tcp-ack-profile':
        result = await TweaksEngine.toggleTcpAckProfile(payload.enabled);
        break;
      case 'games-priority-profile':
        result = await TweaksEngine.toggleGamesPriorityProfile(payload.enabled);
        break;
      case 'high-performance-gpu':
        result = await TweaksEngine.toggleHighPerformanceGpuPreference(payload.enabled);
        break;
      case 'memory-compression':
        result = await TweaksEngine.toggleMemoryCompression(payload.enabled);
        break;
      case 'ntfs-last-access':
        result = await TweaksEngine.toggleNtfsLastAccess(payload.enabled);
        break;
      case 'tcp-fast-open':
        result = await TweaksEngine.toggleTcpFastOpen(payload.enabled);
        break;
      case 'cpu-minimum-state':
        result = await TweaksEngine.toggleCpuMinimumState(payload.enabled);
        break;
      case 'active-cooling':
        result = await TweaksEngine.toggleActiveCooling(payload.enabled);
        break;
      case 'disk-idle-timeout':
        result = await TweaksEngine.toggleDiskIdleTimeout(payload.enabled);
        break;
      case 'network-adapter-power':
        result = await TweaksEngine.toggleNetworkAdapterPowerSaving(payload.enabled);
        break;
      case 'network-rss':
        result = await TweaksEngine.toggleNetworkRss(payload.enabled);
        break;
      case 'network-rsc':
        result = await TweaksEngine.toggleNetworkRsc(payload.enabled);
        break;
      case 'network-lso':
        result = await TweaksEngine.toggleNetworkLso(payload.enabled);
        break;
      case 'sysmain-service':
        result = await TweaksEngine.toggleService('SysMain', payload.enabled, 'SysMain preloading service');
        break;
      case 'search-indexer-service':
        result = await TweaksEngine.toggleService('WSearch', payload.enabled, 'Windows Search indexing service');
        break;
      case 'clean-shader-caches':
        result = await TweaksEngine.cleanShaderCaches();
        break;
      case 'flush-arp-cache':
        result = await TweaksEngine.flushArpCache();
        break;
      case 'game-bar-overlay':
        result = await TweaksEngine.toggleGameBarOverlay(payload.enabled);
        break;
      case 'fullscreen-optimizations':
        result = await TweaksEngine.toggleFullscreenOptimizations(payload.enabled);
        break;
      case 'edge-background':
        result = await TweaksEngine.toggleEdgeBackgroundTasks(payload.enabled);
        break;
      case 'copilot-policy':
        result = await TweaksEngine.toggleCopilotPolicy(payload.enabled);
        break;
      case 'debloat-consumer':
      case 'debloat-xbox':
      case 'debloat-media':
      case 'debloat-3d':
      case 'debloat-communications':
      case 'debloat-ai-web':
      case 'debloat-productivity':
      case 'debloat-full':
        result = await TweaksEngine.removeBloatApps(tweakId.slice(8));
        break;
      case 'delivery-optimization':
        result = await TweaksEngine.toggleDeliveryOptimization(payload.enabled);
        break;
      case 'optimize-tcp':
        result = await TweaksEngine.optimizeTCP();
        break;
      case 'telemetry':
        result = await TweaksEngine.toggleTelemetry(payload.enabled);
        break;
      case 'bing-search':
        result = await TweaksEngine.toggleBingStartSearch(payload.enabled);
        break;
      case 'recall-ai':
        result = await TweaksEngine.toggleRecallAI(payload.enabled);
        break;
      case 'activity-history':
        result = await TweaksEngine.toggleActivityHistory(payload.enabled);
        break;
      case 'ad-id':
        result = await TweaksEngine.toggleAdvertisingID(payload.enabled);
        break;
      case 'location-service':
        result = await TweaksEngine.toggleLocationService(payload.enabled);
        break;
      case 'windows-tips':
        result = await TweaksEngine.toggleWindowsTips(payload.enabled);
        break;
      case 'background-apps':
        result = await TweaksEngine.toggleBackgroundApps(payload.enabled);
        break;
      case 'search-highlights':
        result = await TweaksEngine.toggleSearchHighlights(payload.enabled);
        break;
      case 'app-launch-tracking':
        result = await TweaksEngine.toggleAppLaunchTracking(payload.enabled);
        break;
      case 'windows-spotlight':
        result = await TweaksEngine.toggleWindowsSpotlight(payload.enabled);
        break;
      case 'tailored-experiences':
        result = await TweaksEngine.toggleTailoredExperiences(payload.enabled);
        break;
      case 'windows-widgets':
        result = await TweaksEngine.toggleWindowsWidgets(payload.enabled);
        break;
      case 'classic-context-menu':
        result = await TweaksEngine.restoreClassicContextMenu(payload.enabled);
        break;
      case 'hidden-files':
        result = await TweaksEngine.toggleHiddenFiles(payload.enabled);
        break;
      case 'file-extensions':
        result = await TweaksEngine.toggleFileExtensions(payload.enabled);
        break;
      case 'transparency':
        result = await TweaksEngine.toggleTransparency(payload.enabled);
        break;
      case 'long-paths':
        result = await TweaksEngine.toggleLongPaths(payload.enabled);
        break;
      case 'task-view-button':
        result = await TweaksEngine.toggleTaskViewButton(payload.enabled);
        break;
      case 'windows-dark-mode':
        result = await TweaksEngine.toggleWindowsDarkMode(payload.enabled);
        break;
      case 'taskbar-clock-seconds':
        result = await TweaksEngine.toggleTaskbarClockSeconds(payload.enabled);
        break;
      case 'taskbar-alignment':
        result = await TweaksEngine.setTaskbarAlignment(payload.value);
        break;
      case 'taskbar-size':
        result = await TweaksEngine.setTaskbarSize(payload.value);
        break;
      case 'taskbar-search':
        result = await TweaksEngine.setTaskbarSearchMode(payload.value);
        break;
      case 'explorer-this-pc':
        result = await TweaksEngine.setExplorerOpenTo(payload.enabled);
        break;
      case 'shortcut-prefix':
        result = await TweaksEngine.toggleShortcutPrefix(payload.enabled);
        break;
      case 'flush-dns':
        result = await TweaksEngine.flushDNS();
        break;
      case 'set-dns':
        result = await TweaksEngine.setDNS(payload.preset);
        break;
      case 'clean-temp':
        result = await TweaksEngine.cleanTempFiles();
        break;
      case 'clean-prefetch':
        result = await TweaksEngine.cleanPrefetchCache();
        break;
      case 'clean-event-logs':
        result = await TweaksEngine.cleanEventLogs();
        break;
      case 'clean-update-cache':
        result = await TweaksEngine.cleanWindowsUpdateCache();
        break;
      case 'disable-hibernation':
        result = await TweaksEngine.disableHibernation();
        break;
      case 'empty-recycle':
        result = await TweaksEngine.emptyRecycleBin();
        break;
      case 'create-restore-point':
        result = await TweaksEngine.createRestorePoint();
        break;
      case 'repair-sfc':
        result = await TweaksEngine.runSystemRepair('sfc');
        break;
      case 'repair-dism':
        result = await TweaksEngine.runSystemRepair('dism');
        break;
      case 'repair-winsock':
        result = await TweaksEngine.runSystemRepair('winsock');
        break;
      default:
        result = { success: false, action: tweakId, details: `Unrecognized tweak ID: ${tweakId}` };
    }
    }
  } catch (err) {
    result = { success: false, action: tweakId, details: `Error executing tweak: ${err.message}` };
  } finally {
    tweakBusy = false;
  }

  if (!result.success && TweaksEngine.runPowerShell.lastFailure && !powerOptions.some(item => item.id === tweakId)) result.details = TweaksEngine.runPowerShell.lastFailure;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log-update', {
      timestamp: new Date().toLocaleTimeString(),
      action: result.action,
      success: result.success,
      details: result.details,
    });
  }

  return result;
});

// Window Control IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});
