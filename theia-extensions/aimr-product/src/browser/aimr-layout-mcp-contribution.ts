/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { isPinned, pin, unpin } from '@theia/core/lib/browser/widgets/widget';
import { inject, injectable } from '@theia/core/shared/inversify';
import { z } from 'zod';
import { IDEMCPTool, page, pageFields, required } from './ide-mcp-tool.js';
const areaSchema = z.enum(['main', 'left', 'right', 'bottom']);
const schema = z.object({ action: z.enum(['inspect', 'activate', 'show', 'hide', 'move', 'pin', 'unpin', 'close']), ...pageFields,
    id: z.string().optional(), area: areaSchema.optional() });
@injectable()
export class AIMRLayoutMCPContribution extends IDEMCPTool {
    readonly name = 'ide_layout';
    readonly description = 'Inspect IDE panels/tabs and IDs; activate, show, move, pin, unpin or close an existing widget using id. '
        + 'show/hide accept a sidebar/bottom area; move requires id and area. Use ide_commands to open views not created yet. '
        + 'Pinned tabs must be unpinned before closing; native unsaved-file confirmations are preserved. Does not control the OS window.';
    readonly schema = schema;
    @inject(ApplicationShell) protected readonly shell!: ApplicationShell;
    protected async execute(input: unknown): Promise<object> {
        const args = schema.parse(input);
        if (args.action === 'show' && args.area && !args.id) { this.shell.expandPanel(args.area); } else if (args.action === 'hide') {
            const area = required(args.area, 'area');
            if (area === 'main') { throw new Error('Cannot collapse the main editor area'); }
            await this.shell.collapsePanel(area);
        } else if (args.action !== 'inspect') {
            const id = required(args.id, 'id');
            const widget = this.shell.getWidgetById(id);
            if (!widget) { throw new Error(`Unknown widget ${id}; use ide_commands to open the view first`); }
            if (args.action === 'activate' || args.action === 'show') { await this.shell.activateWidget(id); }
            if (args.action === 'pin' && !isPinned(widget.title)) { pin(widget.title); }
            if (args.action === 'unpin' && isPinned(widget.title)) { unpin(widget.title); }
            if (args.action === 'move') { await this.shell.addWidget(widget, { area: required(args.area, 'area') }); }
            if (args.action === 'close') {
                if (isPinned(widget.title)) { throw new Error('Unpin the tab before closing'); }
                await this.shell.closeWidget(id);
                if (widget.isAttached) { return { status: 'cancelled', id }; }
            }
        }
        return { ...page(this.shell.widgets.map(widget => ({ id: widget.id, label: widget.title.label,
            area: this.shell.getAreaFor(widget), visible: widget.isVisible, pinned: isPinned(widget.title),
            active: this.shell.activeWidget === widget })), args),
            panels: ['left', 'right', 'bottom'].map(area => ({ area, expanded: this.shell.isExpanded(area as ApplicationShell.Area) })) };
    }
}
