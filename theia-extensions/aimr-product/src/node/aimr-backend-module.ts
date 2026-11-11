/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { CodexService } from '@theia/ai-codex/lib/common/codex-service';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { AIMRCodexFactory, AIMRCodexService, createAIMRCodex } from './aimr-codex-service.js';
import { MCPTheiaServerImpl } from '@theia/ai-mcp-server/lib/node/mcp-theia-server-impl';
import { AIMRMCPServer } from './aimr-mcp-server.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { cmd } from '@theia/core/lib/common/os';
import { ContainerModule } from '@theia/core/shared/inversify';
import { AIMRAgentService, AIMR_AGENT_SERVICE_PATH } from '../common/aimr-agent-service.js';
import { TheiaDesktopFileServiceEndpoint } from 'theia-ide-launcher-ext/lib/node/desktopfile-endpoint';
import { AIMRDesktopFileEndpoint } from './aimr-desktop-file-endpoint.js';
import { MCPBackendContribution } from '@theia/ai-mcp-server/lib/node/mcp-theia-server';
import { IDEScreenshotContribution } from './ide-screenshot-contribution.js';
import { IDEScreenshotClient, IDE_SCREENSHOT_PATH } from '../common/ide-screenshot.js';

export async function isCodexInstalled(): Promise<boolean> {
    const [command, args] = cmd('codex', '--version');
    return promisify(execFile)(command, args, { timeout: 3000, windowsHide: true, maxBuffer: 4096 })
        .then(() => true, () => false);
}

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    rebind(TheiaDesktopFileServiceEndpoint).to(AIMRDesktopFileEndpoint).inSingletonScope();
    rebind(MCPTheiaServerImpl).to(AIMRMCPServer).inSingletonScope();
    bind(AIMRCodexFactory).toConstantValue(createAIMRCodex);
    bind(ConnectionContainerModule).toConstantValue(ConnectionContainerModule.create(({ rebind: rebindConnection }) => {
        rebindConnection(CodexService).to(AIMRCodexService).inSingletonScope();
    }));
    bind(ConnectionHandler).toConstantValue(new RpcConnectionHandler<AIMRAgentService>(AIMR_AGENT_SERVICE_PATH, () => ({ isCodexInstalled })));
    bind(IDEScreenshotContribution).toSelf().inSingletonScope();
    bind(MCPBackendContribution).toService(IDEScreenshotContribution);
    bind(ConnectionHandler).toDynamicValue(({ container }) => new RpcConnectionHandler<IDEScreenshotClient>(
        IDE_SCREENSHOT_PATH, client => container.get(IDEScreenshotContribution).connect(client))).inSingletonScope();
});
