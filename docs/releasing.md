# AIMR releases

The MVP ships ordinary Electron for Linux x64: AppImage, Debian package and `SHA256SUMS`. AIMR versions are independent of Theia versions. Codex CLI must be installed on `PATH` and signed in (`codex login`); AIMR reuses it and does not bundle another CLI or credentials. Automatic updates are not enabled.

Desktop packages omit source maps and the Java Extension Pack (including its JVM, Maven and Gradle). Development builds retain source maps. Java support can be installed from the extension registry. Remove cached `plugins/redhat.java` and `plugins/vscjava.*` directories to drop Java from an existing development checkout; packaging also excludes them.

1. Run `corepack yarn release:prepare --ide VERSION` (omit `--theia` unless updating the platform). Add the version and release date to `theia-extensions/aimr-product/resources/linux/site.aimr.app.xml`. Review and commit the version changes.
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

`electron package` uses `--publish never`; `package:prod` / `deploy` publish automatically and are not this flow. The workflow checks packaged startup, MCP operations and voice UI injection in a fresh profile outside the checkout using `test:live` (see CONTRIBUTING.md). Authenticated Codex inference still requires a local smoke check.

Enable GitHub Actions for the repository. Inherited Theia build/Next/image workflows have a one-line repository guard, so they run only in `eclipse-theia/theia-ide`. AIMR builds use the separate release workflow; upstream jobs and schedules otherwise remain unchanged.

For an isolated AppImage run, use temporary `THEIA_CONFIG_DIR` and `--electronUserData` directories and a temporary workspace; preserve the real `HOME` so Codex can reuse the existing login. Pass `--appimage-extract-and-run` when FUSE 2 is unavailable (also used by CI). Codex CLI 0.167.0 was verified for the first release. Never upload the profile or logs containing session credentials.

DEB installs one single-application AppStream catalog, `site.aimr.app.xml`, into both `/usr/share/swcatalog/xml` (system AppStream) and `/usr/share/swcatalog` (App Center's Dart `appstream` 0.2.11 scans flat XML catalogs, not metainfo or the `xml/` subdirectory). Both destinations share one source. A successful system `appstreamcli get` alone does not verify App Center visibility. The catalog links package `aimr` with its name, icons, MIT license and release dates. Keep both `developer` and legacy `developer_name` for current App Center compatibility. Installed-list visibility remains unresolved on the tested host and is deferred; catalog validation is not a UI visibility test. Reopen App Center after installing to reload metadata. Its local-DEB preview still uses a generic icon/package name, and its stable DEB details page has no Open action. Validate with `appstreamcli validate --no-net theia-extensions/aimr-product/resources/linux/site.aimr.app.xml`.

Local DEB upgrades are blocked in App Center 2/stable rev. 1468 even when the file version is newer. Upstream [#2217](https://github.com/ubuntu/app-center/pull/2217) fixes this; as of 2026-11-12 it is in 2/edge, not stable. Upgrade without removing AIMR or its profile with `sudo apt install /absolute/path/to/AIMR-linux-amd64.deb`; use `--reinstall` for an updated package with the same version. Do not switch App Center channels automatically.

For public Ubuntu App Center discovery, publish a Snap through the Snap Store: register a publisher account/name, build with electron-builder, fill the listing (title, description, icon, screenshots) and release to `beta` before `stable`. AIMR's host CLI/filesystem integration likely needs classic confinement, which requires Store approval and runtime verification. This is a planned distribution channel; no Snap is configured or published yet. Publishing a Snap does not change App Center's local-DEB preview. See [Snap publishing](https://snapcraft.io/docs/releasing-your-app/) and [classic confinement](https://snapcraft.io/docs/explanation/security/classic-confinement/).
