# batmaniscool 4.6 — Update Center

Added the Update Center flow for signed NSIS releases. The app now exposes check, download, and restart/install actions through the secure preload bridge. The updater remains inactive in development or private builds without a generated app-update.yml; it never guesses a server or makes background update requests.

Added Settings & backups with local JSON export/import for pending review plans and a queue-only undo-all-history action. Imported plans are allowlisted and never bypass Apply Changes.

The builder configuration now targets the batmantweaks/batmaniscool GitHub Releases feed. Public releases still require a valid signing identity and GitHub Actions secrets. This release can be used to test the UI and build pipeline, but the current local installer is unsigned.
