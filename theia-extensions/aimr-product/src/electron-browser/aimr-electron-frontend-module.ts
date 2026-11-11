/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { ContainerModule } from '@theia/core/shared/inversify';
import { CreateLauncherCommandContribution } from 'theia-ide-launcher-ext/lib/browser/create-launcher-contribution';
import { AIMRLauncherContribution } from './aimr-launcher-contribution.js';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { ElectronIpcConnectionProvider } from '@theia/core/lib/electron-browser/messaging/electron-ipc-connection-source';
import { IDECapture, IDE_CAPTURE_PATH, IDE_SCREENSHOT_PATH } from '../common/ide-screenshot.js';
import { IDEScreenshotFrontend } from './ide-screenshot-client.js';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    rebind(CreateLauncherCommandContribution).to(AIMRLauncherContribution).inSingletonScope();
    bind(IDECapture).toDynamicValue(({ container }) => ElectronIpcConnectionProvider.createProxy(container, IDE_CAPTURE_PATH)).inSingletonScope();
    bind(IDEScreenshotFrontend).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(({ container }) => ({
        onStart: () => { ServiceConnectionProvider.createProxy(container, IDE_SCREENSHOT_PATH, container.get(IDEScreenshotFrontend)); }
    })).inSingletonScope();
});
