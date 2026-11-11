/********************************************************************************
 * Copyright (C) 2020 TypeFox, EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import '../../src/browser/style/index.css';
import { MCPFrontendContribution } from '@theia/ai-mcp-server/lib/browser/mcp-frontend-contribution';
import { AIMRCommandsMCPContribution } from './aimr-commands-mcp-contribution.js';
import { AIMRExtensionsMCPContribution } from './aimr-extensions-mcp-contribution.js';
import { AIMRLayoutMCPContribution } from './aimr-layout-mcp-contribution.js';
import { bindAIMRSettings } from './aimr-settings-mcp-contribution.js';

import { ChatViewWidget } from '@theia/ai-chat-ui/lib/browser/chat-view-widget';
import { AIRegistryConfiguration } from '@theia/ai-registry/lib/common/ai-registry-configuration';
import { WidgetFactory } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { SidebarTopMenuWidgetFactory } from '@theia/core/lib/browser/shell/sidebar-menu-widget';
import { pin } from '@theia/core/lib/browser/widgets/widget';
import { applyBranding } from './aimr-config.js';
import { CommandContribution } from '@theia/core/lib/common/command';
import { ContainerModule } from '@theia/core/shared/inversify';
import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { AIMRAboutDialog } from './aimr-about-dialog.js';
import { AIMRAIRegistryConfiguration } from './aimr-ai-registry-configuration.js';
import { AIMRContribution } from './aimr-contribution.js';
import { AIMRGettingStartedWidget } from './aimr-getting-started-widget.js';
import { AIMRThemeContribution } from './aimr-theme-contribution.js';
import { AIMRStartupContribution } from './aimr-startup-contribution.js';
import { AIMRSidebarMenuWidget } from './aimr-sidebar-menu-widget.js';
import { ProblemContribution } from '@theia/markers/lib/browser/problem/problem-contribution';
import { AIMRProblemContribution } from './aimr-problem-contribution.js';
import { AIMRAgentService, AIMR_AGENT_SERVICE_PATH } from '../common/aimr-agent-service.js';
import { AIChatInputWidget } from '@theia/ai-chat-ui/lib/browser/chat-input-widget';
import { AIMRChatInputWidget, AIMRVoiceContribution } from './aimr-voice-input.js';
import { AIMRVoiceLanguage, AIMR_VOICE_LANGUAGE_PATH } from '../common/aimr-voice.js';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    applyBranding();
    bind(AIMRVoiceLanguage).toDynamicValue(context => ServiceConnectionProvider.createProxy<AIMRVoiceLanguage>(context.container, AIMR_VOICE_LANGUAGE_PATH))
        .inSingletonScope();
    bind(AIMRVoiceContribution).toSelf().inSingletonScope();
    bind(CommandContribution).toService(AIMRVoiceContribution);
    rebind(AIChatInputWidget).to(AIMRChatInputWidget);
    rebind(ProblemContribution).to(AIMRProblemContribution).inSingletonScope();

    bindAIMRSettings(bind);
    [AIMRCommandsMCPContribution, AIMRExtensionsMCPContribution, AIMRLayoutMCPContribution].forEach(contribution =>
        bind(MCPFrontendContribution).to(contribution).inSingletonScope());

    rebind(ChatViewWidget).toSelf().onActivation((_context, widget) => {
        pin(widget.title);
        return widget;
    });

    bind(AIMRAgentService).toDynamicValue(context => ServiceConnectionProvider.createProxy<AIMRAgentService>(context.container, AIMR_AGENT_SERVICE_PATH))
        .inSingletonScope();

    bind(AIMRSidebarMenuWidget).toSelf();
    rebind(SidebarTopMenuWidgetFactory).toAutoFactory(AIMRSidebarMenuWidget);

    bind(AIMRThemeContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(AIMRThemeContribution);
    bind(AIMRStartupContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(AIMRStartupContribution);

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
    [CommandContribution, MenuContribution, FrontendApplicationContribution].forEach(serviceIdentifier =>
        bind(serviceIdentifier).toService(AIMRContribution)
    );

    if (isBound(AIRegistryConfiguration)) {
        rebind(AIRegistryConfiguration).to(AIMRAIRegistryConfiguration).inSingletonScope();
    } else {
        bind(AIRegistryConfiguration).to(AIMRAIRegistryConfiguration).inSingletonScope();
    }
});
