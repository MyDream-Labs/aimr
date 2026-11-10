/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { inject, injectable } from '@theia/core/shared/inversify';
import { MonacoThemeRegistry } from '@theia/monaco/lib/browser/textmate/monaco-theme-registry';
import { Color } from '@theia/monaco-editor-core/esm/vs/base/common/color.js';

@injectable()
export class AIMRThemeContribution implements FrontendApplicationContribution {
    @inject(MonacoThemeRegistry) protected readonly registry!: MonacoThemeRegistry;
    @inject(ThemeService) protected readonly themes!: ThemeService;

    onStart(): void {
        for (const type of ['light', 'dark'] as const) {
            const base = this.registry.getThemeData(`${type}-theia`);
            if (!base) {
                throw new Error(`Missing Theia ${type} theme`);
            }
            const id = `aimr-${type}`;
            const background = type === 'light' ? '#f3f3f3' : '#252526';
            const foreground = Color.Format.CSS.formatHexA(this.registry.getTheme(`${type}-theia`)!.getColor('descriptionForeground')!, true);
            this.registry.setTheme(id, {
                ...base,
                name: id,
                colors: {
                    ...base.colors,
                    'statusBar.background': background,
                    'statusBar.foreground': foreground,
                    'statusBar.noFolderBackground': background,
                    'statusBar.noFolderForeground': foreground,
                    'statusBarItem.remoteBackground': background,
                    'statusBarItem.remoteForeground': foreground,
                    'statusBarItem.remoteHoverBackground': type === 'light' ? '#e5e5e5' : '#333333',
                    'statusBarItem.remoteHoverForeground': foreground
                }
            });
            this.themes.register({
                id,
                label: type === 'light' ? 'AIMR Light' : 'AIMR Dark',
                type,
                editorTheme: id
            });
        }
    }
}
