import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ApplicationPackage } from '@theia/application-package';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AIMRDesktopFileEndpoint } from '../lib/node/aimr-desktop-file-endpoint.js';
import { readFileSync } from 'node:fs';

describe('AIMR desktop composition', () => {
    (process.env.AIMR_DESKTOP_ENTRY ? it : it.skip)('registers the product display name and window identity', () => {
        const entry = readFileSync(process.env.AIMR_DESKTOP_ENTRY,'utf8');
        const app = new ApplicationPackage({projectPath:fileURLToPath(new URL('../../../applications/electron/', import.meta.url))});
        assert.equal(entry.match(/^Name=(.*)$/m)?.[1],app.props.frontend.config.applicationName);
        assert.equal(entry.match(/^StartupWMClass=(.*)$/m)?.[1],new AIMRDesktopFileEndpoint().getAppId());
        if (/^Path=/m.test(entry)) {
            assert.ok(entry.includes('--no-sandbox'));
            assert.ok(entry.includes('--plugins=local-dir:'));
        }
    });
    it('loads common and desktop contributions after the upstream launcher', () => {
        const app = new ApplicationPackage({projectPath:fileURLToPath(new URL('../../../applications/electron/', import.meta.url))});
        const modules = [...app.frontendElectronModules.values()];
        const common = modules.indexOf('aimr-product-ext/lib/browser/aimr-frontend-module');
        const desktop = modules.indexOf('aimr-product-ext/lib/electron-browser/aimr-electron-frontend-module');
        const launcher = modules.indexOf('theia-ide-launcher-ext/lib/browser/create-launcher-frontend-module');
        assert.ok(common >= 0 && launcher >= 0 && desktop > common && desktop > launcher);
        assert.ok([...app.electronMainModules.values()].includes('aimr-product-ext/lib/electron-main/aimr-main-module'));
        assert.equal(new AIMRDesktopFileEndpoint().getAppId(),app.pck.desktopName.replace(/\.desktop$/,''));
    });
    it('creates desktop entries even after a previous decline and reuses matching files', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'aimr-desktop-'));
        const previous = {APPIMAGE:process.env.APPIMAGE,XDG_DATA_HOME:process.env.XDG_DATA_HOME};
        try {
            process.env.APPIMAGE = join(directory,'AIMR.AppImage');
            process.env.XDG_DATA_HOME = directory;
            const endpoint = new AIMRDesktopFileEndpoint();
            endpoint.envServer = {getConfigDirUri:async()=>pathToFileURL(directory).href};
            const storage = join(directory,'globalStorage/theia-ide-launcher');
            await mkdir(storage,{recursive:true});
            await writeFile(join(storage,'desktopfile.json'),JSON.stringify({appImage:'',declined:[process.env.APPIMAGE]}));
            assert.equal(await endpoint.computeState('AIMR','aimr'),'needs-silent-update');
            const applications = endpoint.getApplicationsDir();
            await mkdir(applications,{recursive:true});
            const id = endpoint.getAppId('AIMR'), icon = join(applications,`${id}-electron-app.png`);
            await writeFile(join(applications,`${id}-launcher.desktop`),endpoint.getDesktopFileContents('AIMR',process.env.APPIMAGE,icon));
            await writeFile(join(applications,`${id}-launcher-url.desktop`),endpoint.getDesktopURLFileContents('AIMR',process.env.APPIMAGE,icon,'aimr'));
            assert.equal(await endpoint.computeState('AIMR','aimr'),'up-to-date');
        } finally {
            for (const [key,value] of Object.entries(previous)) { if(value===undefined)delete process.env[key];else process.env[key]=value; }
            await rm(directory,{recursive:true,force:true});
        }
    });
});
