/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { PreferenceScope, PreferenceService, PreferenceSchemaService } from '@theia/core/lib/common/preferences';
import { JsonSchemaDataStore } from '@theia/core/lib/browser/json-schema-store';
import URI from '@theia/core/lib/common/uri';
import Ajv from '@theia/core/shared/ajv';
import { inject, injectable } from '@theia/core/shared/inversify';
import { z } from 'zod';
import { IDEMCPTool, page, pageFields, required } from './ide-mcp-tool.js';

const schema = z.object({ action: z.enum(['search', 'get', 'set', 'reset']), ...pageFields,
    key: z.string().optional(), value: z.unknown().optional(), scope: z.enum(['user', 'workspace']).default('user') });
@injectable()
export class AIMRSettingsMCPContribution extends IDEMCPTool {
    readonly name = 'ide_settings';
    readonly description = 'Search live IDE settings by key/description; get schema, effective value and overrides; set or reset a User/Workspace setting. '
        + 'Use search first. get/set/reset require key; set requires value (JSON null is a value); reset removes the selected scope override.';
    readonly schema = schema;
    @inject(PreferenceService) protected readonly preferences!: PreferenceService;
    @inject(PreferenceSchemaService) protected readonly schemas!: PreferenceSchemaService;

    @inject(JsonSchemaDataStore) protected readonly jsonSchemas!: JsonSchemaDataStore;

    protected async execute(input: unknown): Promise<object> {
        const args = schema.parse(input);
        await Promise.all([this.preferences.ready, this.schemas.ready]);
        if (args.action === 'search') {
            return page([...this.schemas.getSchemaProperties()].map(([id, property]) => ({ id,
                description: property.markdownDescription ?? property.description, type: property.type })), args);
        }
        const key = required(args.key, 'key');
        const definition = this.schemas.getSchemaProperty(key);
        if (!definition) { throw new Error(`Unknown setting: ${key}`); }
        const scope = args.scope === 'user' ? PreferenceScope.User : PreferenceScope.Workspace;
        if (args.action !== 'get') {
            if (!this.schemas.isValidInScope(key, scope)) { throw new Error(`Setting ${key} is not valid in ${args.scope} scope`); }
            if (args.action === 'set') {
                if (!Object.prototype.hasOwnProperty.call(args, 'value')) { throw new Error('Missing value; use reset to remove an override'); }
                const ajv = new Ajv({ allErrors: true, unknownFormats: 'ignore', logger: false, loadSchema: async uri => {
                    const source = this.jsonSchemas.getSchema(new URI(uri));
                    if (!source) { throw new Error(`Schema ${uri} is unavailable in Theia`); }
                    return JSON.parse(source);
                } });
                const scopeSchema = this.schemas.getJSONSchema(scope);
                const validate = await ajv.compileAsync({ ...scopeSchema, properties: { [key]: scopeSchema.properties![key] }, patternProperties: {} });
                if (!validate({ [key]: args.value })) { throw new Error(ajv.errorsText(validate.errors)); }
            }
            await this.preferences.set(key, args.action === 'reset' ? undefined : args.value, scope);
        }
        return { key, value: this.preferences.get(key), overrides: this.preferences.inspect(key), schema: definition };
    }
}
