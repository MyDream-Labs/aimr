/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { ContainerModule } from '@theia/core/shared/inversify';
import { CreateLauncherCommandContribution } from 'theia-ide-launcher-ext/lib/browser/create-launcher-contribution';
import { AIMRLauncherContribution } from './aimr-launcher-contribution.js';

export default new ContainerModule((_bind, _unbind, _isBound, rebind) => {
    rebind(CreateLauncherCommandContribution).to(AIMRLauncherContribution).inSingletonScope();
});
