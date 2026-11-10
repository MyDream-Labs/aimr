Be output-token and turns efficient: satisfy the user's contract correctly with only necessary turns, words, tool calls, files, and code.
Satisfy the user's requested contract with the least owned complexity.
Prefer existing mechanisms over creating new code, files, dependencies, abstractions, APIs, services, or workflows.
Build strong, performant, resource-efficient solutions that are compact, readable, and low-maintenance.

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for development, build, and restart instructions.
Commit completed changes before starting a separate task.

## Upstream compatibility

- Build AIMR through our extensions (`theia-extensions/aimr-*`) and application configuration.
- Reuse Theia APIs, contributions, and DI; keep subclass overrides small. Avoid copying upstream implementations.
- Do not modify Theia core, dependencies, generated files, or upstream product extensions.
- Keep upstream configuration/build changes minimal; consult and update the implementation map in `docs/aimr-upstream.md`.
- Keep AIMR branding consistent across all builds. Preserve third-party licenses and attribution.
- Verify affected builds after changes; run builds that rebuild shared native dependencies sequentially.
