/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { FrontendApplicationConfigProvider } from '@theia/core/lib/browser/frontend-application-config-provider';
import { inject, injectable } from '@theia/core/shared/inversify';
import { CreateLauncherCommandContribution } from 'theia-ide-launcher-ext/lib/browser/create-launcher-contribution';
import { DesktopFileService } from 'theia-ide-launcher-ext/lib/browser/desktopfile-service';

@injectable()
export class AIMRLauncherContribution extends CreateLauncherCommandContribution {
    @inject(DesktopFileService) protected readonly desktopFiles!: DesktopFileService;

    override async onStart(): Promise<void> {
        const { applicationName, electron: { uriScheme } } = FrontendApplicationConfigProvider.get();
        try {
            if (await this.desktopFiles.getState({ applicationName, uriScheme }) !== 'up-to-date') {
                await this.desktopFiles.createOrUpdateDesktopfile(true, { applicationName, uriScheme, createUrlHandler: true });
            }
        } catch (error) {
            this.logger.warn('Could not create the AIMR desktop entry:', error);
        }
        // CLI launcher installation stays an explicit command; startup never requests sudo.
    }
}
