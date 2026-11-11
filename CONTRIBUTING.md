# Development

Requires Node.js 24+ and Yarn 1.

```sh
yarn
yarn electron build
yarn electron start
```

For the desktop MVP, build and run only `electron`. Build `electron-next` or `browser` only when explicitly requested. Application builds compile `aimr-product-ext` automatically. For changes in other extensions, run `yarn build:extensions` first. Run desktop and browser builds sequentially: they share native dependencies.

Develop AIMR in `theia-extensions/aimr-*`; keep application changes limited to configuration and packaging. See [upstream compatibility and repository boundaries](docs/aimr-upstream.md).

For branding, edit `theia-extensions/aimr-product/resources/favicon.svg`, then run:

```sh
yarn icons:generate --color '#0d82ff'
```

Icon generation requires Python 3 with Pillow. Without `--color`, the source colors are preserved.

Before committing, run the relevant lint/build checks. After application changes, rebuild and restart the running development instance. Avoid unrelated changes and preserve upstream licenses.

See [IDE control coverage](docs/ide-control-coverage.md) for supported operations, verification and open questions.

See [AIMR releases](docs/releasing.md) for production packaging and GitHub publication.

MCP smoke checks: `yarn workspace aimr-product-ext test` after building. To include the live IDE control tests, supply `AIMR_MCP_URL` and `AIMR_MCP_COOKIE` for an isolated running Electron profile with an open temporary workspace. These are per-process credentials; do not save them in repository files or logs.

Voice UI smoke: additionally set `AIMR_BROWSER_DEBUG_URL` to that isolated Electron profile's `--remote-debugging-port` URL. The test stubs recording, verifies the microphone before Send, two-click recording, progress until transcript delivery and editable insertion, and restores the draft. The build prepares the AIMR manual-input entry from the pinned, hash-checked VoxPilot. When updating VoxPilot, also test repeated actual ASR with a prerecorded clip; keep the microphone private during automated checks.

Run the combined live checks against an isolated Electron instance started with `--remote-debugging-port=9222`:

```sh
AIMR_BROWSER_DEBUG_URL=http://127.0.0.1:9222 yarn workspace aimr-product-ext test:live
```

The runner supplies MCP credentials in memory. Release CI uses it against the packaged AppImage. Desktop rebuilds automatically restore a missing ffmpeg addon.
