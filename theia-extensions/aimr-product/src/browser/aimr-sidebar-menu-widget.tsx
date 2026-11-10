/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from 'react';
import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { SidebarMenuItem, SidebarMenuWidget } from '@theia/core/lib/browser/shell/sidebar-menu-widget';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { AIMRCommands } from './aimr-contribution.js';

@injectable()
export class AIMRSidebarMenuWidget extends SidebarMenuWidget {
    @inject(CommandRegistry) protected readonly commands!: CommandRegistry;
    @inject(PreferenceService) protected readonly preferences!: PreferenceService;

    @postConstruct()
    protected watchMenuVisibility(): void {
        this.toDispose.push(this.preferences.onPreferenceChanged(event => {
            if (event.preferenceName === 'window.menuBarVisibility') {
                this.update();
            }
        }));
    }

    protected override renderItem(item: SidebarMenuItem): React.ReactNode {
        if (item.menu.id !== AIMRCommands.TOGGLE_MENU.id) {
            return super.renderItem(item);
        }
        const visible = this.commands.isToggled(AIMRCommands.TOGGLE_MENU.id);
        const label = visible ? 'Hide Menu Bar' : 'Show Menu Bar';
        return <button
            key={item.menu.id}
            type='button'
            className='theia-sidebar-menu-item aimr-menu-toggle'
            aria-label={label}
            aria-pressed={visible}
            title={label}
            onClick={() => this.commands.executeCommand(AIMRCommands.TOGGLE_MENU.id)}>
            <i className={item.menu.iconClass} aria-hidden='true' />
        </button>;
    }
}
