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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import { ElectronMainApplication, ElectronMainApplicationContribution } from '@theia/core/lib/electron-main/electron-main-application';

import { injectable } from '@theia/core/shared/inversify';
import { app, BrowserWindow } from '@theia/core/electron-shared/electron';

@injectable()
export class IconContribution implements ElectronMainApplicationContribution {

    onStart(application: ElectronMainApplication): void {
        if (os.platform() === 'linux') {
            const icon = path.join(app.getAppPath(), 'resources/icons/512x512.png');
            if (process.defaultApp) {
                this.registerDevelopmentDesktopEntry(application, icon);
            }
            app.on('browser-window-created', (_event, window) => window.setIcon(icon));
            for (const window of BrowserWindow.getAllWindows()) { window.setIcon(icon); }
        }
    }

    protected registerDevelopmentDesktopEntry(application: ElectronMainApplication, icon: string): void {
        const id = application.config.electron.appUserModelId;
        if (!id) { return; }
        const directory = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'applications');
        const file = path.join(directory, `${id}.desktop`);
        // Exec uses desktop-entry escaping, not shell quoting.
        const quote = (value: string): string => '"' + value.replace(/["\\`$]/g, '\\$&').replace(/\\/g, '\\\\').replace(/%/g, '%%') + '"';
        // Match the existing Linux package launcher on hosts without a configured SUID helper.
        const command = [process.execPath, app.getAppPath(),
            `--plugins=local-dir:${path.resolve(app.getAppPath(), '../../plugins')}`, '--ozone-platform=x11', '--no-sandbox']
            .map(quote).join(' ');
        const contents = `[Desktop Entry]
Type=Application
Name=${application.config.applicationName}
Exec=${command} %U
Path=${app.getAppPath()}
Icon=${icon}
StartupWMClass=${id}
Categories=Development;
`;
        try {
            if (!existsSync(file) || readFileSync(file, 'utf8') !== contents) {
                mkdirSync(directory, { recursive: true });
                writeFileSync(file, contents);
            }
        } catch (error) {
            console.warn('Could not register the AIMR development desktop entry:', error);
        }
    }
}
