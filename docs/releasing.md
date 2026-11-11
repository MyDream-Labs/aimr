# AIMR releases

The MVP ships ordinary Electron for Linux x64: AppImage, Debian package and `SHA256SUMS`. AIMR versions are independent of Theia versions. Codex CLI must be installed on `PATH` and signed in (`codex login`); AIMR reuses it and does not bundle another CLI or credentials. Automatic updates are not enabled.

1. Run `corepack yarn release:prepare --ide VERSION` (omit `--theia` unless updating the platform). Review and commit the version changes.
2. Build locally with the commands below; check the AppImage outside the checkout with an isolated profile. Verify chat/Codex, IDE MCP, built-in extensions and terminal.
3. Push the release commit and tag `vVERSION`. `.github/workflows/aimr-release.yml` builds, smoke-tests and publishes the **rolling `preview` prerelease**. It also supports manual runs from Actions on the release commit.
4. Download the assets and run `sha256sum -c SHA256SUMS`. The preview assets and tag are replaced on successful builds; version tags remain unchanged. Keep this mutable channel separate from immutable versioned releases.

Stable website download URLs (available after the first successful preview publication):

- https://github.com/MyDream-Labs/aimr/releases/download/preview/AIMR-linux-x86_64.AppImage
- https://github.com/MyDream-Labs/aimr/releases/download/preview/AIMR-linux-amd64.deb
- https://github.com/MyDream-Labs/aimr/releases/download/preview/SHA256SUMS

File names omit the version; application and Debian package metadata retain it. Architecture names follow electron-builder conventions. GitHub's `latest` shortcut excludes prereleases, so use the explicit `preview` URLs for alpha/beta builds.

```sh
corepack yarn install --frozen-lockfile
corepack yarn build:extensions
corepack yarn workspace aimr-product-ext lint
corepack yarn workspace aimr-product-ext test
corepack yarn download:plugins
corepack yarn electron build:prod
corepack yarn electron package --linux --x64
cd applications/electron/dist
sha256sum AIMR-*.AppImage AIMR-*.deb > SHA256SUMS
```

`electron package` uses `--publish never`; `package:prod` / `deploy` publish automatically and are not this flow. The workflow checks packaged startup in a fresh profile outside the checkout; authenticated Codex and MCP interaction still require a local smoke check.

Enable GitHub Actions for the repository. Inherited Theia build/Next/image workflows have a one-line repository guard, so they run only in `eclipse-theia/theia-ide`. AIMR builds use the separate release workflow; upstream jobs and schedules otherwise remain unchanged.

For an isolated AppImage run, use temporary `THEIA_CONFIG_DIR` and `--electronUserData` directories and a temporary workspace; preserve the real `HOME` so Codex can reuse the existing login. Pass `--appimage-extract-and-run` when FUSE 2 is unavailable (also used by CI). Codex CLI 0.167.0 was verified for the first release. Never upload the profile or logs containing session credentials.
