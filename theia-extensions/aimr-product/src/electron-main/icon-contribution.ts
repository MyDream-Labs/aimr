/********************************************************************************
 * Copyright (C) 2021 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as os from 'os';
import * as path from 'path';

import { ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';

import { injectable } from '@theia/core/shared/inversify';
import { app, BrowserWindow } from '@theia/core/electron-shared/electron';

@injectable()
export class IconContribution implements ElectronMainApplicationContribution {

    onStart(): void {
        if (os.platform() === 'linux') {
            const icon = path.join(app.getAppPath(), 'resources/icons/512x512.png');
            app.on('browser-window-created', (_event, window) => window.setIcon(icon));
            for (const window of BrowserWindow.getAllWindows()) { window.setIcon(icon); }
        }
    }
}
