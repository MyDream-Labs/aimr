/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import '../../src/browser/style/index.css';

import { AIRegistryConfiguration } from '@theia/ai-registry/lib/common/ai-registry-configuration';
import { WidgetFactory } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { applyBranding } from './aimr-config.js';
import { CommandContribution } from '@theia/core/lib/common/command';
import { ContainerModule } from '@theia/core/shared/inversify';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { AIMRAboutDialog } from './aimr-about-dialog.js';
import { AIMRAIRegistryConfiguration } from './aimr-ai-registry-configuration.js';
import { AIMRContribution } from './aimr-contribution.js';
import { AIMRGettingStartedWidget } from './aimr-getting-started-widget.js';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    applyBranding();

    bind(AIMRGettingStartedWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: GettingStartedWidget.ID,
        createWidget: () => context.container.get<AIMRGettingStartedWidget>(AIMRGettingStartedWidget),
    })).inSingletonScope();
    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(AIMRAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(AIMRAboutDialog).inSingletonScope();
    }

    bind(AIMRContribution).toSelf().inSingletonScope();
    [CommandContribution, MenuContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(AIMRContribution)
    );

    if (isBound(AIRegistryConfiguration)) {
        rebind(AIRegistryConfiguration).to(AIMRAIRegistryConfiguration).inSingletonScope();
    } else {
        bind(AIRegistryConfiguration).to(AIMRAIRegistryConfiguration).inSingletonScope();
    }
});
