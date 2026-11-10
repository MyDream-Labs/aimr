/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { MCPFrontendContribution, ToolProvider } from '@theia/ai-mcp-server/lib/browser/mcp-frontend-contribution';
import { injectable } from '@theia/core/shared/inversify';
import { z } from 'zod';

export const pageFields = { query: z.string().default(''), limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) };
export interface Page { query: string; limit: number; offset: number }
export interface PageResult<T> { items: T[]; total: number; hasMore: boolean; nextOffset?: number }
export function page<T extends { id: string }>(rows: T[], options: Page): PageResult<T> {
    const matching = rows.filter(row => JSON.stringify(row).toLowerCase().includes(options.query.toLowerCase()))
        .sort((a, b) => a.id.localeCompare(b.id));
    const items = matching.slice(options.offset, options.offset + options.limit);
    const hasMore = options.offset + items.length < matching.length;
    return { items, total: matching.length, hasMore, nextOffset: hasMore ? options.offset + items.length : undefined };
}
export function required<T>(value: T | undefined, name: string): T {
    if (value === undefined) { throw new Error(`Missing ${name}`); }
    return value;
}

// Shared only to avoid repeating schema conversion, parsing and error handling.
@injectable()
export abstract class IDEMCPTool implements MCPFrontendContribution {
    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly schema: z.ZodObject;
    protected abstract execute(args: unknown): Promise<object>;
    getTools(): Tool[] {
        return [{ name: this.name, description: this.description, inputSchema: z.toJSONSchema(this.schema) as Tool['inputSchema'] }];
    }
    getTool(name: string): ToolProvider | undefined {
        if (name !== this.name) { return undefined; }
        return { inputSchema: this.schema, handler: async input => {
            try {
                return { status: 'success', ...await this.execute(this.schema.parse(typeof input === 'string' ? JSON.parse(input) : input)) };
            } catch (error) {
                return { status: 'error', message: error instanceof Error ? error.message : String(error) };
            }
        } };
    }
}
