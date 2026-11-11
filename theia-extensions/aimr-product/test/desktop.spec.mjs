import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ApplicationPackage } from '@theia/application-package';

describe('AIMR desktop composition', () => {
    it('loads common and desktop contributions after the upstream launcher', () => {
        const app = new ApplicationPackage({projectPath:fileURLToPath(new URL('../../../applications/electron/', import.meta.url))});
        const modules = [...app.frontendElectronModules.values()];
        const common = modules.indexOf('aimr-product-ext/lib/browser/aimr-frontend-module');
        const desktop = modules.indexOf('aimr-product-ext/lib/electron-browser/aimr-electron-frontend-module');
        const launcher = modules.indexOf('theia-ide-launcher-ext/lib/browser/create-launcher-frontend-module');
        assert.ok(common >= 0 && launcher >= 0 && desktop > common && desktop > launcher);
    });
});
