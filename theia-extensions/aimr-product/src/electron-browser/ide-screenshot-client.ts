/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CaptureRect, IDECapture, IDEScreenshotClient, ScreenshotResult } from '../common/ide-screenshot.js';

@injectable()
export class IDEScreenshotFrontend implements IDEScreenshotClient {
    @inject(ApplicationShell) protected readonly shell!: ApplicationShell;
    @inject(IDECapture) protected readonly native!: IDECapture;

    async capture(widgetId?: string): Promise<ScreenshotResult> {
        let rect: CaptureRect | undefined;
        if (widgetId !== undefined) {
            const widget = this.shell.getWidgetById(widgetId);
            if (!widget) {
                const widgets = (['main', 'left', 'right', 'bottom'] as const).flatMap(area => this.shell.getWidgets(area));
                return { error: 'widget_not_found', widgets: Object.fromEntries(widgets
                    .filter(item => item.isVisible && item.node.ownerDocument === document && this.visibleRect(item.node))
                    .map(item => [item.id, item.title.label])) };
            }
            rect = widget.isVisible && widget.node.ownerDocument === document ? this.visibleRect(widget.node) : undefined;
            if (!rect) {
                return { error: 'widget_not_visible', message: 'Use ide_layout(action="activate", id="' + widgetId + '") before capturing.' };
            }
        }
        return { data: await this.native.capture(Number(window.electronTheiaCore.WindowMetadata.webcontentId), rect) };
    }

    protected visibleRect(node: HTMLElement): CaptureRect | undefined {
        const bounds = node.getBoundingClientRect();
        const x = Math.max(0, bounds.left);
        const y = Math.max(0, bounds.top);
        const width = Math.min(window.innerWidth, bounds.right) - x;
        const height = Math.min(window.innerHeight, bounds.bottom) - y;
        return width > 0 && height > 0 ? { x, y, width, height } : undefined;
    }
}
