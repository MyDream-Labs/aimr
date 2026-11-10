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
