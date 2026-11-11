/* Copyright (C) 2026 MyDream Labs LLC. SPDX-License-Identifier: MIT */
import assert from 'node:assert/strict';
import { connect } from 'puppeteer-core';

export async function connectIDE() {
    assert.ok(process.env.AIMR_BROWSER_DEBUG_URL, 'Set AIMR_BROWSER_DEBUG_URL for an isolated IDE');
    const browser = await connect({ browserURL: process.env.AIMR_BROWSER_DEBUG_URL, defaultViewport: null });
    try {
        const page = (await browser.pages()).find(candidate => candidate.url().includes('index.html'));
        assert.ok(page, 'IDE frontend not found');
        await page.evaluate(async () => {
            const container = window.theia.container;
            // Production minifies class names, but preserves these public methods.
            const get = (...methods) => {
                const key = [...container._bindingDictionary._map.keys()].find(candidate =>
                    methods.every(method => typeof candidate.prototype?.[method] === 'function'));
                if (!key) { throw Error(`IDE service unavailable: ${methods.join(', ')}`); }
                return container.get(key);
            };
            await get('reachedState', 'reachedAnyState').reachedState('ready');
            window.aimrTest = {
                commands: get('executeCommand', 'registerHandler'), shell: get('getWidgetById', 'activateWidget'),
                voice: get('refreshLanguage', 'toggle'), registry: get('getToolName', 'getBaseUrl')
            };
        });
        return { browser, page };
    } catch (error) { await browser.disconnect(); throw error; }
}
