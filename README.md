# AIMR

**Set Goal. Aim. Reach.**

**A living AI-powered workspace that adapts to your goals.**

AIMR is a new kind of work environment that adapts to you, not the other way around. Describe what you need, and let AI help shape your tools and interfaces.

Customize your workspace through natural conversation. Work with AI assistants, files, a terminal, and extensions in one place, with support for multiple AI providers and Codex.

Built on Eclipse Theia, AIMR brings the flexibility of an IDE to everyday work and business.

AIMR is in early development; many capabilities described here are planned rather than available today.

The desktop and browser applications are built on the [Eclipse Theia platform](https://theia-ide.org), an extensible framework for IDEs and tools. AIMR is developed by **MyDream Labs LLC**.

Website: https://aimr.site

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development instructions and upstream compatibility guidelines.

The repository is a Yarn workspaces monorepo. It requires Node.js 24 or newer and Yarn 1.

```sh
yarn
yarn build
```

Run an application during development with `yarn electron start`, `yarn electron-next start` or `yarn browser start`. Build commands and platform packaging details are available in the corresponding application directories and the [Blueprint documentation](https://theia-ide.org/docs/blueprint_documentation/).

## Project structure

- `applications/electron` — desktop application.
- `applications/electron-next` — desktop build reserved for testing upcoming Theia versions; not needed for routine desktop MVP builds. Its product name and profile are also AIMR.
- `applications/browser` — browser application.
- `theia-extensions/aimr-product` — AIMR-owned branding and product UI extension.
- `theia-extensions` — product and integration extensions built on Theia.

The user configuration folder is `.aimr`. AIMR product code lives in its own extension so upstream Theia product files can remain untouched. When updating the upstream framework, review API changes used by `aimr-product-ext`, then build the extension and applications.

## Product direction

AIMR aims to let users describe a goal, configure tools and workflows with AI, then work in a personalized environment. Planned areas include agent-assisted interface changes, plugin bundles, MCP-based application control, local and cloud execution, and a marketplace. These are product goals, not a claim that each feature is implemented in the current build.

See [ARCHITECTURE.md](ARCHITECTURE.md) for architecture decisions and open questions.

## Legal and attribution

AIMR is operated by MyDream Labs LLC, 30 N Gould St, STE R, Sheridan, WY 82801, United States. The company file number is 2026-001893245. Product specific terms, privacy information and support contacts should be published for AIMR before providing hosted services.

AIMR includes Eclipse Theia and third-party components. Their respective licenses and copyright notices remain applicable; see the included license files and component notices.
