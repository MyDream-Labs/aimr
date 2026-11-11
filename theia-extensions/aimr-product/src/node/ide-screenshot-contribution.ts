/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCPBackendContribution } from '@theia/ai-mcp-server/lib/node/mcp-theia-server';
import { RpcProxy } from '@theia/core/lib/common/messaging/proxy-factory';
import { injectable } from '@theia/core/shared/inversify';
import { z } from 'zod';
import { IDEScreenshotClient } from '../common/ide-screenshot.js';

// Frontend MCP delegates serialize results as text. Register here to preserve native image content.
@injectable()
export class IDEScreenshotContribution implements MCPBackendContribution {
    protected client: RpcProxy<IDEScreenshotClient> | undefined;

    connect(client: RpcProxy<IDEScreenshotClient>): object {
        this.client = client;
        client.onDidCloseConnection(() => { if (this.client === client) { this.client = undefined; } });
        return {};
    }

    configure(server: McpServer): void {
        server.registerTool('ide_screenshot', {
            description: 'Capture visible IDE content as an unscaled PNG. Prefer widgetId for targeted captures to reduce context usage; omit for the current window. '
                + 'Find IDs with ide_layout(action="inspect"); activate hidden widgets via action="activate". Open missing views via ide_commands, then inspect again. '
                + 'Unknown IDs return visible widgets as {id:label}. Does not scroll or change layout.',
            inputSchema: { widgetId: z.string().min(1).optional().describe('Exact items[].id from ide_layout(action="inspect").') },
            annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
        }, async ({ widgetId }): Promise<CallToolResult> => {
            try {
                if (!this.client) { throw new Error('No Electron IDE connected'); }
                const result = await this.client.capture(widgetId);
                return 'data' in result
                    ? { content: [{ type: 'image', data: result.data, mimeType: 'image/png' }] }
                    : { isError: true, content: [{ type: 'text', text: JSON.stringify(result) }] };
            } catch (error) {
                return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'capture_failed', message: String(error) }) }] };
            }
        });
    }
}
