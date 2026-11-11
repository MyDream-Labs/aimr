/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { injectable } from '@theia/core/shared/inversify';
import { DesktopFileState, TheiaDesktopFileServiceEndpoint } from 'theia-ide-launcher-ext/lib/node/desktopfile-endpoint';

@injectable()
export class AIMRDesktopFileEndpoint extends TheiaDesktopFileServiceEndpoint {
    protected override getAppId(): string {
        return 'site.aimr.app';
    }

    protected override async computeState(applicationName: string, uriScheme: string): Promise<DesktopFileState> {
        if (!process.env.APPIMAGE || !process.env.HOME) { return 'up-to-date'; }
        // Desktop integration is a product default, including profiles that declined the old prompt.
        return this.isOnDiskUpToDate(applicationName, uriScheme) ? 'up-to-date' : 'needs-silent-update';
    }
}
