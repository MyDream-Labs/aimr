import assert from 'node:assert/strict';
import { Container } from '@theia/core/shared/inversify';
import { JsonSchemaDataStore } from '@theia/core/lib/browser/json-schema-store';
import { PreferenceSchemaService } from '@theia/core/lib/common/preferences';
import { page } from '../lib/browser/ide-mcp-tool.js';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { ConnectionContainerModule } from '@theia/core/lib/node/messaging/connection-container-module';
import { backendGlobal } from '@theia/core/lib/node/backend-global';
import { CodexService } from '@theia/ai-codex/lib/common/codex-service';
import upstreamCodex from '@theia/ai-codex/lib/node/codex-backend-module';
import { MCPFrontendContribution } from '@theia/ai-mcp-server/lib/browser/mcp-frontend-contribution';
import settingsModule, { AIMRSettingsMCPContribution } from '../lib/browser/aimr-settings-mcp-contribution.js';
import upstreamMCP from '@theia/ai-mcp-server/lib/node/mcp-backend-module';
import backendModule from '../lib/node/aimr-backend-module.js';
import { AIMRCodexService, AIMRCodexFactory } from '../lib/node/aimr-codex-service.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

describe('AIMR MCP injections', () => {
    it('resolves the settings contribution and replaces the connection-scoped Codex service', async () => {
        const root = new Container();
        root.bind(PreferenceService).toConstantValue({});
        root.bind(PreferenceSchemaService).toConstantValue({});
        root.bind(JsonSchemaDataStore).toConstantValue({});
        root.load(settingsModule, upstreamCodex, upstreamMCP, backendModule);
        assert.ok(root.get(MCPFrontendContribution) instanceof AIMRSettingsMCPContribution);
        const connection = root.createChild();
        connection.load(...root.getAll(ConnectionContainerModule));
        assert.ok(connection.get(CodexService) instanceof AIMRCodexService);
        const previous = backendGlobal.serverAddress;
        try {
            backendGlobal.serverAddress = Promise.resolve({ address: '127.0.0.1', port: 12345, family: 'IPv4' });
            const sdk = await root.get(AIMRCodexFactory)();
            assert.equal(sdk.options.codexPathOverride, 'codex');
            assert.equal(sdk.options.config.mcp_servers.ide.url, 'http://127.0.0.1:12345/mcp');
            assert.equal(sdk.options.config.mcp_servers.ide.required, true);
            assert.equal(sdk.options.config.mcp_servers.ide.default_tools_approval_mode, 'approve');
            assert.equal(sdk.options.model, undefined);
        } finally { backendGlobal.serverAddress = previous; }
    });
});


describe('IDE pagination', () => {
    it('filters and sorts before slicing; handles the final empty page', () => {
        const rows = [{id:'c'}, {id:'a'}, {id:'b'}];
        const first = page(rows, {query:'',limit:1,offset:0});
        assert.equal(first.items[0].id, 'a');
        assert.equal(page(rows, {query:'',limit:1,offset:first.nextOffset}).items[0].id, 'b');
        assert.deepEqual(page(rows, {query:'',limit:1,offset:3}), {items:[],total:3,hasMore:false,nextOffset:undefined});
        assert.equal(page(rows, {query:'c',limit:1,offset:0}).total, 1);
        const schema = new AIMRSettingsMCPContribution().schema;
        for (const args of [{limit:0}, {limit:101}, {offset:-1}, {offset:0.5}]) {
            assert.equal(schema.safeParse({action:'search',...args}).success, false);
        }
    });
});

const live = process.env.AIMR_MCP_URL ? describe : describe.skip;
live('IDE MCP live frontend (isolated profile)', function () {
    this.timeout(60000);
    let client, tools;
    async function call(base, args, allowError = false) {
        const name = tools.find(tool => tool.name.startsWith(base + '_'))?.name;
        assert.ok(name, `Missing tool ${base}`);
        const result = await client.callTool({name, arguments:args});
        if (result.isError && allowError) return {status:'error',message:result.content[0].text};
        assert.ok(!result.isError, JSON.stringify(result));
        const data = JSON.parse(result.content[0].text);
        if (!allowError) assert.notEqual(data.status, 'error', JSON.stringify(data));
        return data;
    }
    before(async () => {
        client = new Client({name:'ide-smoke',version:'1.0.0'});
        await client.connect(new StreamableHTTPClientTransport(new URL(process.env.AIMR_MCP_URL), {
            requestInit:{headers:{Cookie:process.env.AIMR_MCP_COOKIE ?? ''}}
        }));
        tools = (await client.listTools()).tools;
        assert.equal(client.getServerVersion().name, 'IDE Control — AIMR');
        assert.match(client.getServerVersion().description, /settings, commands, extensions, panels and tabs/);
        assert.match(client.getInstructions(), /running IDE/);
        for (const name of ['ide_settings','ide_commands','ide_extensions','ide_layout']) {
            assert.ok(tools.some(tool=>tool.name.startsWith(name+'_')));
        }
    });
    after(async () => { await client?.close(); });
    it('keeps Problems closed on a fresh layout and allows opening it manually', async function () {
        if (!process.env.AIMR_MCP_FIRST_RUN) { this.skip(); }
        assert.ok(!(await call('ide_layout',{action:'inspect',query:'problems'})).items.some(w=>w.area));
        try {
            await call('ide_commands',{action:'run',id:'problemsView:toggle'});
            assert.ok((await call('ide_layout',{action:'inspect',query:'problems'})).items.some(w=>w.visible));
        } finally {
            await call('ide_layout',{action:'close',id:'problems'});
            await call('ide_layout',{action:'hide',area:'bottom'});
        }
    });
    it('pages settings and changes, validates and resets a user setting; executes a command', async () => {
        const key = 'workbench.statusBar.visible';
        const original = await call('ide_settings',{action:'get',key});
        try {
            const first = await call('ide_settings',{action:'search',limit:1});
            const second = await call('ide_settings',{action:'search',limit:1,offset:first.nextOffset});
            assert.notEqual(first.items[0].id, second.items[0].id);
            assert.deepEqual((await call('ide_settings',{action:'search',offset:1000000})).items,[]);
            assert.equal((await call('ide_settings',{action:'search',offset:-1},true)).status,'error');
            assert.equal((await call('ide_settings',{action:'set',key,value:'wrong-type'},true)).status,'error');
            await call('ide_settings',{action:'set',key,value:!original.value});
            assert.equal((await call('ide_settings',{action:'get',key})).value,!original.value);
            const id = 'workbench.action.toggleStatusbarVisibility';
            assert.ok((await call('ide_commands',{action:'search',query:id})).items.some(command=>command.id===id));
            await call('ide_commands',{action:'run',id});
            assert.equal((await call('ide_settings',{action:'get',key})).value,original.value);
            await call('ide_settings',{action:'reset',key});
            assert.equal((await call('ide_settings',{action:'get',key})).overrides.globalValue,undefined);
        } finally {
            await call('ide_settings',original.overrides.globalValue === undefined ? {action:'reset',key}
                : {action:'set',key,value:original.overrides.globalValue});
        }
    });
    it('writes and resets a workspace setting', async () => {
        const key = 'editor.tabSize';
        const original = await call('ide_settings',{action:'get',key});
        try {
            await call('ide_settings',{action:'set',key,scope:'workspace',value:7});
            assert.equal((await call('ide_settings',{action:'get',key})).overrides.workspaceValue,7);
        } finally {
            await call('ide_settings',original.overrides.workspaceValue === undefined ? {action:'reset',key,scope:'workspace'}
                : {action:'set',key,scope:'workspace',value:original.overrides.workspaceValue});
        }
    });
    it('moves a tab, hides/shows its panel, pins/unpins it and closes a disposable settings tab', async () => {
        const state = await call('ide_layout',{action:'inspect',limit:100});
        const chat = state.items.find(widget=>widget.id==='chat-view-widget');
        assert.ok(chat);
        try {
            await call('ide_layout',{action:'move',id:chat.id,area:'right'});
            await call('ide_layout',{action:'hide',area:'right'});
            assert.equal((await call('ide_layout',{action:'inspect'})).panels.find(p=>p.area==='right').expanded,false);
            await call('ide_layout',{action:'show',area:'right'});
            await call('ide_layout',{action:'activate',id:chat.id});
            await call('ide_layout',{action:'unpin',id:chat.id});
            await call('ide_layout',{action:'pin',id:chat.id});
            assert.equal((await call('ide_layout',{action:'inspect',query:chat.id})).items[0].pinned,true);
        } finally {
            await call('ide_layout',{action:'move',id:chat.id,area:chat.area});
            await call('ide_layout',{action:chat.pinned?'pin':'unpin',id:chat.id});
            for (const panel of state.panels) await call('ide_layout',{action:panel.expanded?'show':'hide',area:panel.area});
        }
        await call('ide_commands',{action:'run',id:'preferences:open'});
        const created = (await call('ide_layout',{action:'inspect',limit:100})).items.find(w=>w.id==='settings_widget'&&w.area==='main');
        assert.ok(created);
        await call('ide_layout',{action:'close',id:created.id});
        assert.ok(!(await call('ide_layout',{action:'inspect',query:created.id})).items.find(w=>w.id===created.id)?.visible);
    });
    it('installs, disables, enables and uninstalls a local test VSIX', async () => {
        const {mkdtemp,rm} = await import('node:fs/promises');
        const {createWriteStream} = await import('node:fs');
        const {tmpdir} = await import('node:os');
        const {join} = await import('node:path');
        const {pathToFileURL} = await import('node:url');
        const {default:archiver} = await import('archiver');
        const directory = await mkdtemp(join(tmpdir(),'ide-vsix-'));
        const id = 'aimr-smoke.control-fixture';
        try {
            const file = join(directory,'fixture.vsix');
            const archive = archiver('zip');
            const output = createWriteStream(file);
            const done = new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);archive.on('error',reject);});
            archive.pipe(output);
            archive.append(JSON.stringify({name:'control-fixture',publisher:'aimr-smoke',version:'0.0.1',engines:{vscode:'*'},
                contributes:{configuration:{properties:{'aimrSmoke.enabled':{type:'boolean',default:false},'aimrSmoke.nullable':{type:['string','null'],default:null}}}}}),{name:'extension/package.json'});
            archive.append('<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"/>',{name:'extension.vsixmanifest'});
            await archive.finalize();await done;
            await call('ide_extensions',{action:'install',id,uri:pathToFileURL(file).href});
            assert.ok((await call('ide_extensions',{action:'list',query:id})).items.some(extension=>extension.id===id));
            for (let attempt=0;attempt<40;attempt++) {
                const ready = await call('ide_settings',{action:'get',key:'aimrSmoke.nullable'},true);
                if (ready.status !== 'error') break;
                await new Promise(resolve=>setTimeout(resolve,50));
            }
            await call('ide_settings',{action:'set',key:'aimrSmoke.nullable',value:null});
            assert.equal((await call('ide_settings',{action:'get',key:'aimrSmoke.nullable'})).overrides.globalValue,null);
            await call('ide_settings',{action:'reset',key:'aimrSmoke.nullable'});
            assert.equal((await call('ide_settings',{action:'get',key:'aimrSmoke.nullable'})).overrides.globalValue,undefined);
            await call('ide_extensions',{action:'disable',id});
            assert.equal((await call('ide_extensions',{action:'list',query:id})).items[0].disabled,true);
            await call('ide_extensions',{action:'enable',id});
            assert.equal((await call('ide_extensions',{action:'list',query:id})).items[0].disabled,false);
        } finally {
            if ((await call('ide_extensions',{action:'list',query:id})).items.length) await call('ide_extensions',{action:'uninstall',id});
            assert.equal((await call('ide_extensions',{action:'list',query:id})).items.length,0);
            await rm(directory,{recursive:true,force:true});
        }
    });
    it('searches the configured extension registry with pagination', async () => {
        const first = await call('ide_extensions',{action:'search',query:'theme',limit:1});
        assert.equal(first.items.length,1);
        assert.equal(first.hasMore,true);
        assert.equal(first.nextOffset,1);
        const second = await call('ide_extensions',{action:'search',query:'theme',limit:1,offset:first.nextOffset});
        assert.ok(second.items[0].id);
        assert.notEqual(first.items[0].id,second.items[0].id);
    });
    it('accepts a second sequential client connection', async () => {
        await client.close();
        client = new Client({name:'ide-reconnect-smoke',version:'1.0.0'});
        await client.connect(new StreamableHTTPClientTransport(new URL(process.env.AIMR_MCP_URL),{
            requestInit:{headers:{Cookie:process.env.AIMR_MCP_COOKIE ?? ''}}
        }));
        tools = (await client.listTools()).tools;
        assert.ok((await call('ide_settings',{action:'search',limit:1})).items.length);
    });
});
