# Release, update, and signing setup

The app now contains an updater integration, but private builds deliberately do not contact a release server. A signed public release needs two things that are not stored in this repository:

1. An Authenticode signing identity, such as a code-signing certificate or Azure Trusted Signing configuration.
2. An HTTPS update feed, such as a GitHub Release, S3 bucket, or another controlled release server.

## Test an unsigned installer

```powershell
npm run dist:unsigned
```

This writes an NSIS installer to `dist/installer-v4.5`. It is a private-test installer, not a public signed release. Windows may show an unknown-publisher warning.

## Configure a public update feed

Create `app-update.yml` in the packaged app resources by configuring an electron-builder publish provider. Example for a generic HTTPS feed:

```yaml
publish:
  provider: generic
  url: https://updates.example.com/batmaniscool
```

Do not use a guessed URL. The feed must be under your control and use HTTPS. The app detects the generated `app-update.yml` and enables update checks only in that packaged release.

## Sign a release

Set your signing provider's credentials only in secure CI secrets or the certificate store. Do not place a certificate, password, token, or private key in this project. Electron Builder discovers supported signing credentials during packaging and signs the installer/executables.

For a public release, build with `npm run dist:installer`, upload the installer plus electron-builder's update metadata to the configured feed, install the prior signed version, and verify: check, download, restart, and rollback. Keep the certificate publisher name consistent across releases.

## Current status

The unsigned NSIS build pipeline and in-app status/check buttons are present. No update URL or signing certificate has been configured, so the application correctly stays in private-build mode and cannot claim that updates or signing are active.
