/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { CommandRegistry } from '@theia/core/lib/common/command';
import { inject, injectable } from '@theia/core/shared/inversify';
import { z } from 'zod';
import { IDEMCPTool, page, pageFields, required } from './ide-mcp-tool.js';
const schema = z.object({ action: z.enum(['search', 'run']), ...pageFields, id: z.string().optional(), args: z.array(z.unknown()).default([]) });
@injectable()
export class AIMRCommandsMCPContribution extends IDEMCPTool {
    readonly name = 'ide_commands';
    readonly description = 'Search registered IDE commands by ID/label or run a command using id and optional JSON args. '
        + 'Availability depends on selection/focus. Argument schemas are not provided by Theia. Some commands open native dialogs or reload the IDE.';
    readonly schema = schema;
    @inject(CommandRegistry) protected readonly commands!: CommandRegistry;
    protected async execute(input: unknown): Promise<object> {
        const args = schema.parse(input);
        if (args.action === 'search') {
            return page(this.commands.commands.map(command => ({ id: command.id, label: command.label,
                category: command.category, enabled: this.commands.isEnabled(command.id) })), args);
        }
        const id = required(args.id, 'id');
        if (!this.commands.getCommand(id)) { throw new Error(`Unknown command: ${id}`); }
        const result = await this.commands.executeCommand(id, ...args.args);
        return { id, result: ['string', 'number', 'boolean'].includes(typeof result) ? result : undefined,
            message: 'Command completed; inspect IDE state to verify its effect.' };
    }
}
