/* Copyright (C) 2026 MyDream Labs LLC. SPDX-License-Identifier: MIT */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { connectIDE } from './browser-fixture.mjs';

// Run only against an isolated profile. Obtain credentials through CDP; never print or persist them.
const { browser, page } = await connectIDE();
try {
    const cookie = (await browser.cookies()).find(candidate => candidate.name === 'THEIA_ELECTRON_TOKEN');
    assert.ok(cookie, 'Electron authentication cookie not found');
    const frontend = new URL(page.url());
    const port = frontend.searchParams.get('port');
    assert.ok(frontend.protocol !== 'file:' || port, 'Electron backend port not found');
    const origin = frontend.protocol === 'file:' ? `http://127.0.0.1:${port}` : frontend.origin;
    const child = spawn(process.execPath, [createRequire(import.meta.url).resolve('mocha/bin/mocha.js'), 'test/*.spec.mjs'], {
        cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit',
        env: { ...process.env, AIMR_MCP_URL: `${origin}/mcp`, AIMR_MCP_COOKIE: `${cookie.name}=${cookie.value}` }
    });
    process.exitCode = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', code => resolve(code ?? 1));
    });
} finally { await browser.disconnect(); }
