const { contextBridge } = require('electron');
const calls = [];
contextBridge.exposeInMainWorld('testHarness', { calls: () => calls.slice() });
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemStats: async () => ({ cpuLoadPct: 15, memUsagePct: 45, totalMemGB: 32, usedMemGB: 14, freeMemGB: 18, diskFreeGB: 200, diskTotalGB: 1000, cpuModel: 'Test CPU', cpuCores: 8, osName: 'Windows (test)', arch: 'x64', hostname: 'TEST', uptimeHours: 3 }),
  getPingLatency: async () => [], getTopProcesses: async () => [], getStartupApps: async () => [{Name:'Discord',Command:'Discord.exe',Scope:'Current user'}], getNvidiaInfo: async () => ({ available: false }),
  getDriverStatus: async () => [{DeviceName:'Test GPU',Manufacturer:'Test',DriverVersion:'1.0.0',DriverDate:'2026-09-12'}],
  getNetworkDiagnostics: async () => ({Adapter:'Ethernet',LinkSpeed:'1 Gbps',Gateway:'192.168.1.1',AverageMs:14,JitterMs:2,PacketLoss:0}), openStartupSettings: async () => ({success:true,details:'Opened Windows Startup Apps settings.'}),
  getAppInfo: async () => ({name:'batmaniscool',version:'4.6.0'}),
  getUpdateStatus: async () => ({configured:false,state:'Private build — no update server configured.',details:'Updates disabled.'}),
  checkForUpdates: async () => ({configured:false,state:'Private build — no update server configured.',details:'Updates disabled.'}),
  applyTweak: async (id, payload) => { calls.push({ id, payload }); return id === 'keyboard-repeat' ? { success: false, details: 'Simulated access denied' } : { success: true, action: id, details: 'Mock change only', undoPayload: id.startsWith('power-') && !payload.restore ? {restore:true} : null }; },
  onLogUpdate: () => {}, minimizeWindow: () => {}, maximizeWindow: () => {}, closeWindow: () => {}
});
