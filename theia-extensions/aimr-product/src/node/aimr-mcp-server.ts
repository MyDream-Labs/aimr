/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { IDE_SERVER, IDE_INSTRUCTIONS } from '../common/ide-control.js';
import type { Request, Response } from '@theia/core/shared/express';
import { injectable } from '@theia/core/shared/inversify';
import { MCPTheiaServerImpl } from '@theia/ai-mcp-server/lib/node/mcp-theia-server-impl';

// Stage 1 supports one MCP client at a time. The upstream singleton McpServer
// cannot attach a new HTTP transport until the previous transport is closed.
@injectable()
export class AIMRMCPServer extends MCPTheiaServerImpl {
    protected override async registerContributions(): Promise<void> {
        this.server = new McpServer(IDE_SERVER, { instructions: IDE_INSTRUCTIONS,
            capabilities: { tools: { listChanged: true }, resources: { listChanged: true }, prompts: { listChanged: true } } });
        await super.registerContributions();
    }

    protected override async handleStreamableHttpRequest(req: Request, res: Response): Promise<void> {
        if (!req.headers['mcp-session-id']) {
            await this.server?.close();
            this.httpTransports.clear();
        }
        await super.handleStreamableHttpRequest(req, res);
    }
}
