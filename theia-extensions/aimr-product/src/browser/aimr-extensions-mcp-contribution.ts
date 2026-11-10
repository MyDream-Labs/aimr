/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { CommandRegistry } from '@theia/core/lib/common/command';
import URI from '@theia/core/lib/common/uri';
import { inject, injectable } from '@theia/core/shared/inversify';
import { HostedPluginServer, PluginServer, PluginType, PluginIdentifiers } from '@theia/plugin-ext/lib/common/plugin-protocol';
import { VSXRegistryService } from '@theia/vsx-registry/lib/common/vsx-registry-service';
import { VSXExtensionsModel } from '@theia/vsx-registry/lib/browser/vsx-extensions-model';
import { z } from 'zod';
import { IDEMCPTool, page, pageFields, required } from './ide-mcp-tool.js';
const schema = z.object({ action: z.enum(['search', 'list', 'install', 'uninstall', 'enable', 'disable']), ...pageFields,
    id: z.string().optional(), version: z.string().optional(), uri: z.string().optional() });
@injectable()
export class AIMRExtensionsMCPContribution extends IDEMCPTool {
    readonly name = 'ide_extensions';
    readonly description = 'Search the configured IDE extension registry; list installed extensions; install/uninstall/enable/disable by publisher.name ID. '
        + 'Install accepts optional version, or id plus a local file: VSIX uri. Native trust/verification dialogs may require user interaction. Built-ins cannot be removed.';
    readonly schema = schema;
    @inject(VSXRegistryService) protected readonly registry!: VSXRegistryService;
    @inject(VSXExtensionsModel) protected readonly model!: VSXExtensionsModel;
    @inject(HostedPluginServer) protected readonly plugins!: HostedPluginServer;
    @inject(PluginServer) protected readonly management!: PluginServer;
    @inject(CommandRegistry) protected readonly commands!: CommandRegistry;
    protected async execute(input: unknown): Promise<object> {
        const args = schema.parse(input);
        if (args.action === 'search') {
            const result = await this.registry.search({ query: args.query, offset: args.offset, size: args.limit + 1 });
            const hasMore = result.extensions.length > args.limit;
            return { items: result.extensions.slice(0, args.limit).map(extension => ({ id: `${extension.namespace}.${extension.name}`,
                version: extension.version, description: extension.description })), hasMore, nextOffset: hasMore ? args.offset + args.limit : undefined };
        }
        const installed = async () => {
            const removed = new Set(await this.management.getUninstalledPlugins());
            return (await this.management.getInstalledPlugins()).filter(versioned => !removed.has(versioned))
                .map(versioned => ({ id: PluginIdentifiers.toUnversioned(versioned), versioned }));
        };
        if (args.action === 'list') {
            const disabledIds = new Set(await this.management.getDisabledPlugins());
            return page((await installed()).map(extension => ({ ...extension, disabled: disabledIds.has(extension.id),
                builtin: this.model.isBuiltIn(extension.id) })), args);
        }
        const id = required(args.id, 'id').toLowerCase();
        const before = (await installed()).find(extension => extension.id === id);
        if (args.action !== 'install' && !before) { throw new Error(`Extension ${id} is not installed`); }
        if (args.action === 'install' && args.uri) {
            const uri = new URI(args.uri);
            if (uri.scheme !== 'file') { throw new Error('VSIX installation requires a local file: URI'); }
            await this.commands.executeCommand('workbench.extensions.installExtension', uri);
        } else if (args.action === 'install') {
            const extension = await this.model.resolve(id);
            await extension.install(args.version ? { version: args.version } : undefined);
        } else {
            if (args.action === 'uninstall') {
                const [metadata] = await this.plugins.getDeployedPlugins([required(before, 'installed extension').versioned]);
                if (!metadata) { throw new Error('Extension metadata is unavailable; retry after deployment finishes'); }
                if (metadata.type === PluginType.System) { throw new Error('Built-in extensions cannot be uninstalled'); }
                await this.management.uninstall(required(before, 'installed extension').versioned);
            }
            if (args.action === 'enable') { await this.management.enablePlugin(id as PluginIdentifiers.UnversionedId); }
            if (args.action === 'disable') { await this.management.disablePlugin(id as PluginIdentifiers.UnversionedId); }
        }
        const after = (await installed()).find(extension => extension.id === id);
        if (args.action === 'install' && !after) {
            return { status: args.uri ? 'error' : 'cancelled', id, installed: false, message: 'Requested extension ID was not installed; inspect the installed list.' };
        }
        if (args.action === 'install' && args.version && after
            && PluginIdentifiers.idAndVersionFromVersionedId(after.versioned)?.version !== args.version) {
            return { status: 'cancelled', id, installed: true, versioned: after.versioned };
        }
        if (args.action === 'uninstall' && before && after) { return { status: 'cancelled', id, installed: true }; }
        const disabled = (await this.management.getDisabledPlugins()).includes(id as PluginIdentifiers.UnversionedId);
        const deployed = (await this.plugins.getDeployedPluginIds()).some(versioned => PluginIdentifiers.toUnversioned(versioned) === id);
        return { status: (!!after && !disabled) === deployed ? 'success' : 'requires_reload', id, installed: !!after, versioned: after?.versioned, disabled };
    }
}
