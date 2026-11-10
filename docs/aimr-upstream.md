# AIMR changes on top of Eclipse Theia IDE

AIMR keeps its product UI and branding in `theia-extensions/aimr-product`. It subclasses Theia's About dialog and Getting Started widget, and provides its own frontend bindings, Help commands, styles and icons. `applications/electron`, `applications/electron-next` and `applications/browser` depend on `aimr-product-ext`; they do not load `theia-ide-product-ext`.

The canonical icon source is `theia-extensions/aimr-product/resources/favicon.svg`. Regenerate SVG/PNG/ICO/ICNS, installer sidebars and splash assets with `yarn icons:generate`; preserve the original colors by default or override them with `yarn icons:generate --color '#1c211f'`. The generator uses resvg to render the SVG and Python 3 with Pillow to package the raster formats. Edit the source, then regenerate assets rather than redrawing icons or editing generated copies.

The current AIMR icon color is `#0d82ff`: use `yarn icons:generate --color '#0d82ff'` to regenerate the current product assets. The canonical SVG retains its original color.

All applications use the generated `theia-extensions/aimr-product/resources/preload.html` through `theia.generator.config.preloadTemplate`; this replaces the upstream loading logo without editing framework or upstream preload sources.

Develop features in AIMR-owned extensions (`theia-extensions/aimr-*`). Keep changes to upstream application manifests and packaging scripts limited to integration and configuration. Keep upstream-owned `theia-extensions/product`, `launcher`, `updater`, shared `configs`, and framework sources unchanged for product features; document any necessary exceptions here. Never edit `node_modules`, `lib`, `src-gen` or `dist` directly.

When updating the upstream Theia IDE, review changes in the base About dialog and Getting Started widget APIs, then build `aimr-product-ext` and all application targets. Keep the upstream `theia-extensions/product` sources intact; port a needed upstream behavior into the AIMR extension deliberately.

The application manifests carry product-specific names and runtime settings:

- `applications/*/package.json`: AIMR display name, company/site metadata, `.aimr` configuration folder and product extension dependency. Electron apps also use the `site.aimr.app` application ID and `aimr` URI scheme.
- `applications/electron/electron-builder.yml` and `applications/electron-next/electron-builder.yml`: AIMR package identity, vendor, app icons and splash screen. Eclipse publishing feeds are removed until AIMR has release hosting.
- `applications/electron/resources` and `applications/electron-next/resources`: AIMR icon and splash assets used by installers and launchers.
- `applications/electron/scripts/theia-electron-main.js` and `applications/electron-next/scripts/theia-electron-main.js`: AppImage plugin data uses `.aimr`, matching the Theia configuration folder.
- `applications/browser/ico/favicon.ico`: browser tab icon.
- `package.json`: extension build command includes the AIMR-owned extension.

The desktop updater dependency is intentionally absent until AIMR update feeds exist. The existing release workflow already accepts separate `--ide` and `--theia` versions: use `--ide` for the AIMR release and `--theia` for the Eclipse Theia dependency update. Workspace extension versions follow the AIMR monorepo release, while `@theia/*` dependencies follow the selected platform version.
