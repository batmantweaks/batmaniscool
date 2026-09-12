# batmaniscool 4.4 — Power controls & catalog polish

Eight selectable power controls offer 24 values: CPU energy/performance preference, boost policy, maximum and minimum CPU state, cooling preference, PCIe link power saving, wireless adapter power policy, and disk idle timeout. Five replace older on/off cards. Only the active power plan's plugged-in values are changed. Battery values are untouched. Settings unsupported by the PC report a failure; some controls require administrator access. No FPS or ping gain is guaranteed.

New power controls capture their original values before the first write, verify the result, attempt rollback on failure, and support Queue original value / History restore. The original power plan must be active to restore. Repeated changes keep the first saved original, not a per-change timeline; restoring consumes that backup. Older legacy controls still use their existing inverse-setting behavior.

Three browser controls: sleeping tabs, speculative page preloading, and hardware graphics acceleration. These are optional browser policies, not universal gaming boosts. Restart Edge after changing graphics acceleration. Sleeping-tabs and network-prediction policies do not apply to personal Microsoft-account browser profiles; organizational policy may take precedence. Sleeping tabs may already be enabled.

Extreme queues 42 controls, Balanced 21, and Low-Impact 9. Profiles include appropriate new power values, show counts, replace their previous queue selections, and preserve earlier manually queued settings when switching. The browser experiments are intentionally manual rather than bundled into gaming profiles.

UI: charcoal/brass palette, bat login emblem, opaque login background, roomier cards, category jump buttons, queued-only filtering, and clearer power dropdowns. Profiles and selections only queue; Apply Changes executes. Retired nine duplicate/unsubstantiated registry entries; older captured backups remain accessible for restore through History. Corrected Explorer preview-handler/tooltip labels and taskbar flash value type.

Validation: offline Electron UI tests with an isolated temporary account and mocked Windows actions; catalog allowlisting and PowerShell syntax parsing; all 24 power choices tested using a fake command adapter, including original restore, unsupported settings, invalid input, rollback, and mismatched plans. No real registry, power, network, or app-removal operations were run. This is not a hardware benchmark or verification of every legacy tweak.

Implementation references:

- [Microsoft powercfg command reference](https://learn.microsoft.com/en-us/windows-hardware/design/device-experiences/powercfg-command-line-options)
- [CPU energy/performance preference](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/options-for-perf-state-engine-perfenergypreference)
- [CPU boost policy](https://learn.microsoft.com/en-us/windows-hardware/customize/power-settings/options-for-perf-state-engine-perfboostmode)
- [Edge sleeping tabs](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/SleepingTabsEnabled)
- [Edge network prediction](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/NetworkPredictionOptions)
- [Edge graphics acceleration](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/HardwareAccelerationModeEnabled)

Test status: the first engine and Electron UI runs passed. A final expanded run after adding restore-only compatibility for retired entries was not approved. That compatibility path and the extra end-to-end power-apply assertions remain unverified; there was no final packaged-app test. The package was built successfully, but this should be treated as an update to test, not a fully validated release.

Distribution: send the entire `batmaniscool-win32-x64` folder (or ZIP it), not just the executable. This update does not add code signing or an installer. The local profile/login is not a Windows security boundary. Keep old builds until you have tested the new one on your own hardware.
