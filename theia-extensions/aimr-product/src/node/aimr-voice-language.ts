/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { injectable } from '@theia/core/shared/inversify';
import { DOMParser, type Document, type Element } from '@xmldom/xmldom';
import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import lcid from 'lcid';
import type { IKeyboardLayoutInfo } from 'native-keymap';
import { promisify } from 'util';
import { AIMRVoiceLanguage } from '../common/aimr-voice.js';

export function whisperLanguage(locale: string | undefined): string | undefined {
    if (!locale) { return undefined; }
    try {
        const language = new Intl.Locale(locale.replace(/_/g, '-')).language;
        return ({ nb: 'no', nn: 'no', fil: 'tl', jv: 'jw' } as Record<string, string>)[language] ?? language;
    } catch { return undefined; }
}

export function xkbLanguage(registry: Document, source: string): string | undefined {
    const [name, variant] = source.split('+');
    const item = (element: Element): Element | undefined => Array.from(element.childNodes)
        .find(node => node.nodeName === 'configItem') as Element | undefined;
    const named = (element: Element, value: string): boolean => item(element)?.getElementsByTagName('name')[0]?.textContent === value;
    const layout = Array.from(registry.getElementsByTagName('layout')).find(element => named(element, name));
    if (!layout) { return undefined; }
    const selected = variant && Array.from(layout.getElementsByTagName('variant')).find(element => named(element, variant));
    const language = (element: Element): string | undefined => item(element)?.getElementsByTagName('iso639Id')[0]?.textContent ?? undefined;
    return whisperLanguage((selected && language(selected)) || language(layout));
}

export function layoutLanguage(info: IKeyboardLayoutInfo | undefined, registry?: Document, gnomeSources?: string): string | undefined {
    if (!info) { return undefined; }
    if ('lang' in info) { return whisperLanguage(info.lang); }
    if ('name' in info) { return whisperLanguage(lcid.from(parseInt(info.name.slice(-4), 16))); }
    let sources = info.layout.split(',').map((layout, index) => `${layout}+${info.variant.split(',')[index] ?? ''}`);
    if (gnomeSources !== undefined) {
        // GNOME/XWayland can expose only "us" in XKB names while the active group is Russian.
        const configured = Array.from(gnomeSources.matchAll(/\('([^']+)',\s*'([^']+)'\)/g));
        // Larger lists are partitioned into XKB groups; IBus indices are not XKB indices.
        if (!configured.length || configured.length > 3 || configured.some(source => source[1] !== 'xkb')) { return undefined; }
        sources = configured.map(source => source[2]);
    }
    return registry && sources[info.group] ? xkbLanguage(registry, sources[info.group]) : undefined;
}

@injectable()
export class AIMRVoiceLanguageService implements AIMRVoiceLanguage {
    protected registry: Promise<Document> | undefined;

    async getLanguage(info: IKeyboardLayoutInfo): Promise<string | undefined> {
        try {
            if (!info || !('layout' in info)) { return layoutLanguage(info); }
            let sources: string | undefined;
            if (/gnome/i.test(process.env.XDG_CURRENT_DESKTOP ?? '')) {
                sources = (await promisify(execFile)('gsettings', ['get', 'org.gnome.desktop.input-sources', 'sources'],
                    { timeout: 1000, maxBuffer: 16384 })).stdout;
            }
            this.registry ??= readFile('/usr/share/X11/xkb/rules/evdev.xml', 'utf8')
                .then(xml => new DOMParser().parseFromString(xml, 'text/xml'));
            return layoutLanguage(info, await this.registry, sources);
        } catch { return undefined; } // Use the user's explicit VoxPilot language when detection is unavailable.
    }
}
