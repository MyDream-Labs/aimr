/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { Codex, Thread } from '@openai/codex-sdk';
import { CodexBackendRequest, CodexClient, CodexService } from '@theia/ai-codex/lib/common/codex-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import { backendGlobal } from '@theia/core/lib/node/backend-global';
import { ElectronSecurityToken } from '@theia/core/lib/electron-common/electron-token';

export const AIMRCodexFactory = Symbol('AIMRCodexFactory');
export type AIMRCodexFactory = () => Promise<Codex>;

export const createAIMRCodex: AIMRCodexFactory = async () => {
    const address = await backendGlobal.serverAddress;
    if (!address) { throw new Error('AIMR backend address is unavailable'); }
    const token = process.env[ElectronSecurityToken];
    return new Codex({
        env: { ...process.env, AIMR_MCP_COOKIE: token ? `${ElectronSecurityToken}=${encodeURIComponent(token)}` : '' },
        config: { mcp_servers: { ide: {
        url: `http://127.0.0.1:${address.port}/mcp`,
        env_http_headers: { Cookie: 'AIMR_MCP_COOKIE' },
        // IDE control is explicitly delegated to this local server; native Theia confirmations remain.
        default_tools_approval_mode: 'approve',
        required: true
    } } } });
};

// The upstream service constructs Codex without options. Keep its RPC/UI contract,
// but supply per-process MCP configuration without changing the user's config.toml.
@injectable()
export class AIMRCodexService implements CodexService {
    @inject(AIMRCodexFactory) protected readonly createCodex!: AIMRCodexFactory;
    private client!: CodexClient;
    private readonly threads = new Map<string, Thread>();
    private readonly requests = new Map<string, AbortController>();

    setClient(client: CodexClient): void { this.client = client; }

    async send(request: CodexBackendRequest, streamId: string): Promise<void> {
        this.run(request, streamId);
    }

    private async run(request: CodexBackendRequest, streamId: string): Promise<void> {
        const abort = new AbortController();
        this.requests.set(streamId, abort);
        try {
            const session = request.sessionId ?? streamId;
            let thread = this.threads.get(session);
            if (!thread) {
                thread = (await this.createCodex()).startThread({ ...request.options, skipGitRepoCheck: true });
                this.threads.set(session, thread);
            }
            const { events } = await thread.runStreamed(request.prompt, { signal: abort.signal });
            for await (const event of events) { this.client.sendToken(streamId, event); }
        } catch (error) {
            if (!abort.signal.aborted) { this.client.sendError(streamId, error instanceof Error ? error : new Error(String(error))); }
        } finally {
            this.requests.delete(streamId);
            this.client.sendToken(streamId, undefined);
        }
    }

    cancel(streamId: string): void { this.requests.get(streamId)?.abort(); }
    dispose(): void { for (const request of this.requests.values()) { request.abort(); } }
}
