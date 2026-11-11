import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { IDEScreenshotContribution } from '../lib/node/ide-screenshot-contribution.js';

describe('IDE screenshot MCP contract', () => {
    it('preserves native images, validates IDs and never falls back after failure/disconnect', async () => {
        const contribution = new IDEScreenshotContribution();
        const server = new McpServer({name:'screenshot-test',version:'1'});
        contribution.configure(server);
        const [transport, peer] = InMemoryTransport.createLinkedPair();
        const client = new Client({name:'test',version:'1'});
        await server.connect(transport);
        await client.connect(peer);
        try {
            assert.equal((await client.callTool({name:'ide_screenshot',arguments:{}})).isError,true);
            let calls = 0, disconnect;
            const missing = {error:'widget_not_found',widgets:Object.fromEntries(Array.from({length:12},(_,i)=>['view-'+i,'View '+i]))};
            contribution.connect({
                onDidCloseConnection: callback => { disconnect = callback; },
                capture: async id => { calls++; return id === 'missing' ? missing : {data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='}; }
            });
            const image = await client.callTool({name:'ide_screenshot',arguments:{}});
            assert.deepEqual(image.content,[{type:'image',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',mimeType:'image/png'}]);
            const error = await client.callTool({name:'ide_screenshot',arguments:{widgetId:'missing'}});
            assert.equal(error.isError,true);
            assert.deepEqual(JSON.parse(error.content[0].text),missing);
            assert.equal((await client.callTool({name:'ide_screenshot',arguments:{widgetId:''}})).isError,true);
            assert.equal(calls,2);
            disconnect();
            assert.equal((await client.callTool({name:'ide_screenshot',arguments:{}})).isError,true);
            assert.equal(calls,2);
        } finally { await client.close(); await server.close(); }
    });
});

(process.env.AIMR_MCP_URL ? describe : describe.skip)('IDE screenshot live Electron injection', function () {
    this.timeout(20000);
    it('captures a real PNG and returns visible IDs on errors', async () => {
        const client = new Client({name:'screenshot-smoke',version:'1'});
        try {
            await client.connect(new StreamableHTTPClientTransport(new URL(process.env.AIMR_MCP_URL), {
                requestInit:{headers:{Cookie:process.env.AIMR_MCP_COOKIE ?? ''}}
            }));
            const tools = (await client.listTools()).tools;
            assert.ok(tools.some(tool=>tool.name==='ide_screenshot'));
            const result = await client.callTool({name:'ide_screenshot',arguments:{}});
            assert.ok(!result.isError,JSON.stringify(result));
            assert.equal(result.content[0].type,'image');
            assert.equal(result.content[0].mimeType,'image/png');
            assert.equal(Buffer.from(result.content[0].data,'base64').subarray(1,4).toString(),'PNG');
            const error = await client.callTool({name:'ide_screenshot',arguments:{widgetId:'not-a-widget'}});
            assert.equal(error.isError,true);
            const details = JSON.parse(error.content[0].text);
            assert.equal(details.error,'widget_not_found');
            assert.ok(Object.keys(details.widgets).length>0);
            const widget = await client.callTool({name:'ide_screenshot',arguments:{widgetId:Object.keys(details.widgets)[0]}});
            assert.ok(!widget.isError,JSON.stringify(widget));
            assert.equal(widget.content[0].type,'image');
            assert.equal((await client.callTool({name:'ide_screenshot',arguments:{widgetId:''}})).isError,true);
            const layout = await client.callTool({name:tools.find(tool=>tool.name.startsWith('ide_layout_')).name,
                arguments:{action:'inspect',limit:100}});
            const hiddenId = JSON.parse(layout.content[0].text).items.find(item=>!item.visible).id;
            const hidden = await client.callTool({name:'ide_screenshot',arguments:{widgetId:hiddenId}});
            assert.equal(hidden.isError,true);
            assert.equal(JSON.parse(hidden.content[0].text).error,'widget_not_visible');
        } finally { await client.close(); }
    });
});
