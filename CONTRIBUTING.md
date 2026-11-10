# Development

Requires Node.js 24+ and Yarn 1.

```sh
yarn
yarn electron build
yarn electron start
```

Use `electron-next` or `browser` instead of `electron` for other targets. Application builds compile `aimr-product-ext` automatically. For changes in other extensions, run `yarn build:extensions` first. Run desktop and browser builds sequentially: they share native dependencies.

Develop AIMR in `theia-extensions/aimr-*`; keep application changes limited to configuration and packaging. See [upstream compatibility and repository boundaries](docs/aimr-upstream.md).

For branding, edit `theia-extensions/aimr-product/resources/favicon.svg`, then run:

```sh
yarn icons:generate --color '#0d82ff'
```

Icon generation requires Python 3 with Pillow. Without `--color`, the source colors are preserved.

Before committing, run the relevant lint/build checks. After application changes, rebuild and restart the running development instance. Avoid unrelated changes and preserve upstream licenses.
