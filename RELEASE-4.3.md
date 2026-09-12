# batmaniscool 4.3

Added 16 optional Windows controls covering background activity, desktop input preferences, privacy, Explorer, and appearance. New controls capture the original registry value locally, verify writes, and restore the captured value when switched off. Some settings require signing out or restarting an app; policies may be managed by an organization.

Added individual removal options for Clipchamp, OneNote, Solitaire, Weather, News, Feedback Hub, Maps, and To Do. All debloat actions now target only the current account; they do not remove provisioning or affect other accounts. Removing an app can erase its local data. Reinstall through Microsoft Store; removal is not a one-click History restore.

Added queued SFC verification and DISM CheckHealth checks under System Repair. These need administrator access and do not automatically repair Windows.

Searchable pages, collapsible groups, larger cards, charcoal/gold styling, redesigned login, and locally bundled icons. Aim Trainer remains removed.

Fixed profiles accumulating old choices, missing on/off values from the details drawer, mirrored toggles getting out of sync, repeated Apply clicks, and unsuccessful changes being cleared and reported as successful. New PowerShell execution uses encoded arguments, a hidden process, and reports command errors. The legacy RAM-purge placeholder now reports that it is unavailable instead of claiming system-wide memory was freed.

Validation: Electron UI tests run against an isolated temporary profile with all system actions mocked. Backend tests verify catalog allowlisting, generated apply/restore scripts, scoped removals, command error propagation, and PowerShell parsing without running tweaks. No registry, power, network, or installed-app changes were applied to the development PC. Actual FPS/ping improvements and every legacy tweak are not verified by these tests. Older History entries use the opposite setting, not an exact snapshot.

Implementation references: [Microsoft Remove-AppxPackage](https://learn.microsoft.com/en-us/powershell/module/appx/remove-appxpackage) and [Microsoft Edge policy reference](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies).
