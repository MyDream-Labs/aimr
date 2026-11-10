# AIMR changes on top of Eclipse Theia IDE

AIMR keeps its product UI and branding in `theia-extensions/aimr-product`. It subclasses Theia's About dialog and Getting Started widget, and provides its own frontend bindings, Help commands, styles and icons. `applications/electron`, `applications/electron-next` and `applications/browser` depend on `aimr-product-ext`; they do not load `theia-ide-product-ext`.

## Implementation map

Check this map before adding a mechanism; update it when its location or behavior changes. Source paths below are relative to `theia-extensions/aimr-product/` unless stated otherwise.

| Concern | Where | Mechanism |
| --- | --- | --- |
| Frontend registration | `src/browser/aimr-frontend-module.ts` | Theia DI bindings and contributions |
| Chat-first startup | `src/browser/aimr-startup-contribution.ts` | `initializeLayout()` selects upstream `ai-first`, detaches Debug/Testing/Outline/Memory Inspector views, collapses both side panels and activates the chat only when no saved layout is restored |
| About / Welcome | `src/browser/aimr-about-dialog.tsx`, `aimr-getting-started-widget.tsx`, `branding-util.tsx` | Subclasses of Theia widgets; shared product text |
| Themes / status bar colors | `src/browser/aimr-theme-contribution.ts` | Inherits installed Theia palettes; secondary text uses `descriptionForeground` |
| Help commands / links | `src/browser/aimr-contribution.tsx` | Command and menu contributions |
| Menu bar toggle | `src/browser/aimr-contribution.tsx`, `aimr-sidebar-menu-widget.tsx`; binding in `aimr-frontend-module.ts` | Top-left ☰ button runs `aimr:toggle-menu`, saving `window.menuBarVisibility` as `visible` or `toggle` in user preferences. Alt can reveal a hidden menu. A small sidebar adapter renders only this item as a direct button; other items use Theia's renderer. |
| AI registry identity | `src/browser/aimr-ai-registry-configuration.ts` | Tool ID `aimr`; requires a corresponding registry entry |
| Desktop icon | `src/electron-main/aimr-main-module.ts`, `icon-contribution.ts` | Electron main contribution |
| Icon source | `resources/favicon.svg` | Canonical SVG; never redraw generated copies |
| Icons / splash / preload generation | Repository `scripts/generate-aimr-icons.js` | `yarn icons:generate --color '#0d82ff'`; 276×276 splash, centered 240×240 icon, background `#f5f5f5`; splash and preload have no text |
| Product defaults / launch | Repository `applications/*/package.json` | `theia.frontend.config` and scripts; desktop `start` uses XWayland |
| Desktop UI zoom | Repository `applications/electron{,-next}/package.json`; `src/browser/aimr-startup-contribution.ts` | Default `window.zoomLevel: 1` gives 120% on first launch (`1.2 ** zoomLevel = 1.2`); saved user preferences take precedence. Startup applies the effective preference once; Theia handles later user changes. Theia 1.77 only listens for preference changes, so its initial default otherwise remains unapplied. Recheck this workaround on upstream updates. |
| Window geometry / layout persistence | Upstream Theia | Existing window-state storage and shell layout restorer; no AIMR persistence implementation |

### Chat-first startup

Application defaults set `workbench.startupEditor: "none"`, `toolbar.showToolbar: false`, `workbench.statusBar.visible: false`, `window.menuBarVisibility: "toggle"` and `ai-features.AiEnable.enableAI: true`. One frontend contribution in `src/browser/aimr-startup-contribution.ts`, registered in `aimr-frontend-module.ts`, activates the existing `ai-first` perspective, detaches Debug/Testing/Outline/Memory Inspector widgets from the sidebars, collapses both side panels (including sessions) and focuses the existing chat through `initializeLayout()`. Detaching keeps the widgets alive for deferred Debug initialization and reopening through View commands. This hook runs only when no layout can be restored; Theia handles subsequent persistence. Chat and session history use upstream `ChatViewWidget` and `AISessionsWidget`. Existing profiles can use **Reset Workbench Layout** to apply the new defaults. Hidden views, **Toggle Toolbar**, **Toggle Status Bar Visibility** and **Switch Perspective** remain available in the command palette; the menu bar starts hidden and can be shown with ☰ or Alt. Users can disable AI or configure models in settings; tool confirmation defaults are unchanged.

## Integration details

The canonical icon source is `theia-extensions/aimr-product/resources/favicon.svg`. Regenerate SVG/PNG/ICO/ICNS, installer sidebars and splash assets with `yarn icons:generate`; preserve the original colors by default or override them with `yarn icons:generate --color '#1c211f'`. The generator uses resvg to render the SVG and Python 3 with Pillow to package the raster formats. Edit the source, then regenerate assets rather than redrawing icons or editing generated copies.

The current AIMR icon color is `#0d82ff`: use `yarn icons:generate --color '#0d82ff'` to regenerate the current product assets. The canonical SVG retains its original color.

All applications use the generated `theia-extensions/aimr-product/resources/preload.html` through `theia.generator.config.preloadTemplate`; this replaces the upstream loading logo without editing framework or upstream preload sources.

Desktop development start scripts pass `--ozone-platform=x11` to restore window positions through XWayland on Linux; native Wayland does not support positioning windows.

AIMR Light/Dark are registered in `aimr-product/src/browser/aimr-theme-contribution.ts` using Theia's theme services. They derive from the installed Theia themes and override only status bar colors; application `defaultTheme` selects them. Debugging colors and user-selected themes are preserved.

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
