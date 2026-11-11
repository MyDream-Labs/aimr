/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { ContainerModule } from '@theia/core/shared/inversify';
import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';
import { IconContribution } from './icon-contribution.js';
import { ElectronConnectionHandler } from '@theia/core/lib/electron-main/messaging/electron-connection-handler';
import { RpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { IDE_CAPTURE_PATH } from '../common/ide-screenshot.js';
import { IDECaptureService } from './ide-capture.js';

export default new ContainerModule(bind => {
    bind(IconContribution).toSelf().inSingletonScope();
    bind(ElectronMainApplicationContribution).toService(IconContribution);
    bind(IDECaptureService).toSelf().inSingletonScope();
    bind(ElectronConnectionHandler).toDynamicValue(({ container }) =>
        new RpcConnectionHandler(IDE_CAPTURE_PATH, () => container.get(IDECaptureService))).inSingletonScope();
});
