/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { execFile } from 'child_process';
import { promisify } from 'util';
import { ConnectionHandler, RpcConnectionHandler } from '@theia/core/lib/common';
import { cmd } from '@theia/core/lib/common/os';
import { ContainerModule } from '@theia/core/shared/inversify';
import { AIMRAgentService, AIMR_AGENT_SERVICE_PATH } from '../common/aimr-agent-service.js';

export async function isCodexInstalled(): Promise<boolean> {
    const [command, args] = cmd('codex', '--version');
    return promisify(execFile)(command, args, { timeout: 3000, windowsHide: true, maxBuffer: 4096 })
        .then(() => true, () => false);
}

export default new ContainerModule(bind => {
    bind(ConnectionHandler).toConstantValue(new RpcConnectionHandler<AIMRAgentService>(AIMR_AGENT_SERVICE_PATH, () => ({ isCodexInstalled })));
});
