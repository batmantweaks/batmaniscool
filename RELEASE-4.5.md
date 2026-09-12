# batmaniscool 4.5 — private release candidate

## New experience

- A first-run welcome guide appears after the first successful local sign-in. It explains review, queue, Apply Changes, and restore behavior. Completion is stored only in the local app profile.
- Added About, Support, and Privacy pages. About shows the app version and update state; Support explains safe reporting and undo; Privacy makes the local-data boundary explicit.
- Added **Queue Full Debloat**. It queues a single curated request containing the seven visible optional app groups. It does not remove Windows components, Microsoft Store, Edge, drivers, provisioning, or apps belonging to another Windows account. It does not run until Apply Changes is pressed. App removal may erase local app data and cannot be automatically restored.

## Installer and updates

- Added an NSIS installer build pipeline using electron-builder.
- Added updater status and a Check for updates control. Private builds intentionally remain offline because they have no configured release feed.
- Installed Electron updater/build tooling and documented the required signing/update-feed setup in [UPDATE_AND_SIGNING.md](UPDATE_AND_SIGNING.md).
- Built and tested a private **unsigned** Windows installer. It is not a public signed release and Windows may warn about its publisher.

## Validation

All tests used mocked Windows calls. The engine test passed catalog restores, individual app-removal actions, the curated full-debloat request, power controls, invalid input, rollback, and mismatched-plan checks. The Electron UI test passed against both the source and the packaged app; it includes first-run welcome, queue-only full debloat, login, profiles, reset, responsive cards, and original-value restore checks.

No actual registry, power, service, network, app-removal, or cleanup changes were applied while testing.

## Public-release blocker

The installer is not signed. Public signing and live update checks require your own Authenticode/Trusted Signing identity and an HTTPS update feed under your control. These credentials and URLs are intentionally not guessed or stored in the project.
