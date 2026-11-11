import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import { layoutLanguage, whisperLanguage } from '../lib/node/aimr-voice-language.js';
import { voiceInsertion } from '../lib/common/aimr-voice.js';

describe('AIMR voice language and spacing', () => {
    it('maps native macOS and Windows locales, including layout variants', () => {
        for (const [lang,expected] of [['ru','ru'],['pt-BR','pt'],['zh-Hans','zh'],['nb-NO','no'],['fil','tl'],['jv','jw']]) {
            assert.equal(layoutLanguage({lang}),expected);
        }
        for (const [name,expected] of [['00000409','en'],['00010419','ru'],['0000040c','fr'],['00000411','ja']]) {
            assert.equal(layoutLanguage({name}),expected);
        }
        assert.equal(whisperLanguage('invalid_locale_?'),undefined);
        assert.equal(layoutLanguage(undefined),undefined);
    });
    it('keeps dictated chunks separate without duplicating surrounding whitespace', () => {
        assert.equal(voiceInsertion(' New phrase. ','Previous.',''),' New phrase. ');
        assert.equal(voiceInsertion('New phrase.','Previous. ',''),'New phrase. ');
        assert.equal(voiceInsertion('New','before',' after'),' New');
        assert.equal(voiceInsertion('New','','after'),'New ');
        assert.equal(voiceInsertion('  ','before','after'),'');
    });
    (process.platform==='linux'?it:it.skip)('uses XKB language metadata and GNOME sources instead of stale XWayland names', () => {
        const registry=new DOMParser().parseFromString(readFileSync('/usr/share/X11/xkb/rules/evdev.xml','utf8'),'text/xml');
        const info={layout:'us',variant:'',group:1};
        const sources="[('xkb', 'us'), ('xkb', 'ru')]";
        assert.equal(layoutLanguage(info,registry,sources),'ru');
        assert.equal(layoutLanguage({...info,group:0},registry,sources),'en');
        for(const [layout,expected] of [['de','de'],['fr','fr'],['cz','cs'],['gr','el'],['es','es']]) {
            assert.equal(layoutLanguage({layout,variant:'',group:0},registry),expected);
        }
        assert.equal(layoutLanguage({...info,group:2},registry,sources),undefined);
        assert.equal(layoutLanguage(info,registry,"[('xkb', 'us'), ('ibus', 'mozc-jp')]"),undefined);
        assert.equal(layoutLanguage(info,registry,"[('xkb','us'),('xkb','ru'),('xkb','de'),('xkb','fr')]"),undefined);
    });
});
