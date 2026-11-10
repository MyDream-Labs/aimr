/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ChatViewWidget } from '@theia/ai-chat-ui/lib/browser/chat-view-widget';
import { AI_FIRST_PERSPECTIVE_ID } from '@theia/ai-ide/lib/browser/ai-first-perspective-contribution';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { PerspectiveService } from '@theia/core/lib/browser/perspective-service';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import type { TheiaCoreAPI } from '@theia/core/lib/electron-common/electron-api';
import { inject, injectable } from '@theia/core/shared/inversify';
import { DebugWidget } from '@theia/debug/lib/browser/view/debug-widget';
import { MemoryLayoutWidget } from '@theia/memory-inspector/lib/browser/wrapper-widgets/memory-layout-widget';
import { OUTLINE_WIDGET_FACTORY_ID } from '@theia/outline-view/lib/browser/outline-view-contribution';
import { TEST_VIEW_CONTAINER_ID } from '@theia/test/lib/browser/view/test-view-contribution';

@injectable()
export class AIMRStartupContribution implements FrontendApplicationContribution {
    @inject(PerspectiveService) protected readonly perspectives!: PerspectiveService;
    @inject(PreferenceService) protected readonly preferences!: PreferenceService;

    async onStart(): Promise<void> {
        const electron: TheiaCoreAPI | undefined = window.electronTheiaCore;
        if (electron) {
            // Theia handles zoom changes, but does not apply the initial preference.
            await this.preferences.ready;
            electron.setZoomLevel(this.preferences.get<number>('window.zoomLevel', 0));
        }
    }

    async initializeLayout(app: FrontendApplication): Promise<void> {
        await this.perspectives.switchPerspective(AI_FIRST_PERSPECTIVE_ID);
        const hiddenViews = [DebugWidget.ID, TEST_VIEW_CONTAINER_ID, OUTLINE_WIDGET_FACTORY_ID, MemoryLayoutWidget.ID];
        for (const widget of [...app.shell.getWidgets('left'), ...app.shell.getWidgets('right')]) {
            if (hiddenViews.includes(widget.id)) {
                // Keep views alive for deferred initialization and reopening via View commands.
                // eslint-disable-next-line no-null/no-null -- Lumino requires null to detach widgets.
                widget.parent = null;
            }
        }
        await app.shell.collapsePanel('left');
        await app.shell.collapsePanel('right');
        await app.shell.activateWidget(ChatViewWidget.ID);
    }
}
