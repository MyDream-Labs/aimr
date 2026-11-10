/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { inject, injectable } from '@theia/core/shared/inversify';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { Command, CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { MenuContribution, MenuModelRegistry, MenuPath } from '@theia/core/lib/common/menu';
import { WindowService } from '@theia/core/lib/browser/window/window-service';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { PreferenceScope, PreferenceService } from '@theia/core/lib/common/preferences';
import { codicon } from '@theia/core/lib/browser/widgets';

export namespace AIMRMenus {
    export const AIMR_HELP: MenuPath = [...CommonMenus.HELP, 'aimr'];
}
export namespace AIMRCommands {
    export const CATEGORY = 'AIMR';
    export const TOGGLE_MENU: Command = {
        id: 'aimr:toggle-menu',
        category: CATEGORY,
        label: 'Toggle Menu Bar'
    };
    export const REPORT_ISSUE: Command = {
        id: 'aimr:report-issue',
        category: CATEGORY,
        label: 'Report Issue'
    };
    export const DOCUMENTATION: Command = {
        id: 'aimr:documentation',
        category: CATEGORY,
        label: 'Documentation'
    };
}

@injectable()
export class AIMRContribution implements CommandContribution, MenuContribution, FrontendApplicationContribution {

    @inject(WindowService)
    protected readonly windowService!: WindowService;

    @inject(PreferenceService)
    protected readonly preferences!: PreferenceService;

    static REPORT_ISSUE_URL = 'https://aimr.site';
    static DOCUMENTATION_URL = 'https://aimr.site';

    onStart(app: FrontendApplication): void {
        app.shell.leftPanelHandler.addTopMenu({
            id: AIMRCommands.TOGGLE_MENU.id,
            iconClass: codicon('menu'),
            title: AIMRCommands.TOGGLE_MENU.label!,
            menuPath: ['aimr', 'toggle-menu'],
            order: 0
        });
    }

    registerCommands(commandRegistry: CommandRegistry): void {
        const isMenuVisible = () => ['visible', 'classic'].includes(this.preferences.get('window.menuBarVisibility', 'toggle'));
        commandRegistry.registerCommand(AIMRCommands.TOGGLE_MENU, {
            execute: () => this.preferences.set('window.menuBarVisibility', isMenuVisible() ? 'toggle' : 'visible', PreferenceScope.User),
            isToggled: isMenuVisible
        });
        commandRegistry.registerCommand(AIMRCommands.REPORT_ISSUE, {
            execute: () => this.windowService.openNewWindow(AIMRContribution.REPORT_ISSUE_URL, { external: true })
        });
        commandRegistry.registerCommand(AIMRCommands.DOCUMENTATION, {
            execute: () => this.windowService.openNewWindow(AIMRContribution.DOCUMENTATION_URL, { external: true })
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(AIMRMenus.AIMR_HELP, {
            commandId: AIMRCommands.REPORT_ISSUE.id,
            label: AIMRCommands.REPORT_ISSUE.label,
            order: '1'
        });
        menus.registerMenuAction(AIMRMenus.AIMR_HELP, {
            commandId: AIMRCommands.DOCUMENTATION.id,
            label: AIMRCommands.DOCUMENTATION.label,
            order: '2'
        });
    }
}
