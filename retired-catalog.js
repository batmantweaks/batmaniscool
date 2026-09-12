// Restore-only definitions: older releases may have captured originals for these.
// Never expose these as new tweaks or allow writes of their former preset values.
const reg = (id, tab, title, description, path, name, value, type = 'DWord') => ({id,tab,title,description,path,name,value,type});
module.exports = [
reg('show-fps-widget', 'performance', 'Enable Game Bar performance widget', 'Enables the Windows Game Bar performance overlay preference. Game Bar must remain enabled for this to be useful.', 'HKCU:\\Software\\Microsoft\\GameBar', 'ShowPerformanceWidget', 1),
reg('mouse-click-lock', 'performance', 'Disable Mouse ClickLock', 'Turns off the Windows ClickLock drag feature for faster standard drag behavior. Sign out to refresh.', 'HKCU:\\Control Panel\\Mouse', 'ClickLock', '0', 'String'),
reg('captured-cursor-border', 'performance', 'Disable capture cursor border', 'Turns off the visible cursor border used by supported Windows capture paths.', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\GameDVR', 'CursorCaptureBorderEnabled', 0),
reg('menu-animation', 'performance', 'Reduce menu animation', 'Turns off desktop menu fade effects for a snappier Windows interface. Sign out to refresh.', 'HKCU:\\Control Panel\\Desktop', 'MenuAnimation', '0', 'String'),
reg('activity-upload', 'stealth', 'Disable activity-history upload', 'Stops this device uploading activity history to Microsoft services.', 'HKCU:\\Software\\Policies\\Microsoft\\Windows\\System', 'UploadUserActivities', 0),
reg('sync-provider-ads', 'stealth', 'Hide OneDrive-style ads in Explorer', 'Stops Explorer cloud sync-provider notifications and promotional prompts.', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', 'ShowSyncProviderNotifications', 0),
reg('disk-defrag-notify', 'maintenance', 'Enable scheduled drive optimization', 'Allows Windows to run its normal scheduled drive optimization. Windows selects the correct behavior for SSDs and hard disks.', 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OptimalLayout', 'EnableAutoLayout', 1),
reg('maintenance-warnings', 'maintenance', 'Show automatic-maintenance warnings', 'Shows Windows maintenance warning notifications when attention is needed.', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Maintenance', 'MaintenanceDisabled', 0),
reg('crash-dumps', 'maintenance', 'Disable local crash dumps', 'Turns off local user-mode crash dump creation. Debugging tools will have less information after app crashes.', 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\Windows Error Reporting\\LocalDumps', 'DumpCount', 0),
];
