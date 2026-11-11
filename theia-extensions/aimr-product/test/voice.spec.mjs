import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

describe('AIMR voice defaults', () => {
    it('bundles a pinned VoxPilot and keeps voice output as an English chat draft', () => {
        const root = JSON.parse(readFileSync(new URL('../../../package.json',import.meta.url)));
        assert.match(root.theiaPlugins['natearcher-ai.voxpilot'], /\/\d+\.\d+\.\d+\/file\/natearcher-ai\.voxpilot-\d+\.\d+\.\d+\.vsix$/);
        for (const app of ['electron','electron-next','browser']) {
            const prefs = JSON.parse(readFileSync(new URL(`../../../applications/${app}/package.json`,import.meta.url))).theia.frontend.config.preferences;
            assert.equal(prefs['voxpilot.model'],'whisper-base');
            assert.equal(prefs['voxpilot.language'],'en');
            assert.equal(prefs['voxpilot.outputAction'],'chat');
            assert.equal(prefs['voxpilot.autoSubmitRules'].chat,false);
        }
    });
});

(process.env.AIMR_BROWSER_DEBUG_URL ? describe : describe.skip)('AIMR voice live Electron injection', function () {
    this.timeout(20000);
    it('keeps one microphone before Send, routes its command and inserts editable text without sending', async () => {
        const {connect} = await import('puppeteer-core');
        const browser = await connect({browserURL:process.env.AIMR_BROWSER_DEBUG_URL,defaultViewport:null});
        try {
            const page = (await browser.pages()).find(page=>page.url().includes('index.html'));
            const result = await page.evaluate(async () => {
                const container = window.theia.container;
                const get = name=>container.get([...container._bindingDictionary._map.keys()].find(key=>key.name===name||key.description===name));
                const input = get('ApplicationShell').getWidgetById('chat-view-widget').inputWidget;
                const commands = get('CommandRegistry');
                const editor = input.editor.getControl();
                const original = editor.getValue(), selection = editor.getSelection();
                const requests = input._chatModel.getRequests().length;
                let toggles = 0, finishTranscription;
                const transcription = new Promise(resolve=>{finishTranscription=resolve;});
                const start = commands.registerHandler('aimr.voice.startRecording',{execute:async()=>{
                    toggles++;
                    return {state:'recording'};
                }});
                const stop = commands.registerHandler('aimr.voice.stopRecording',{execute:async()=>{
                    toggles++;
                        await transcription;
                        await commands.executeCommand('workbench.action.chat.open',{query:'Dictated text.'});
                    return {state:'idle'};
                }});
                try {
                    editor.setValue('Typed draft: ');
                    editor.setPosition({lineNumber:1,column:14});
                    input.node.querySelector('.aimr-voice-button').click();
                    await new Promise(resolve=>setTimeout(resolve,30));
                    const latched = input.node.querySelector('.aimr-voice-button').getAttribute('aria-pressed');
                    input.node.querySelector('.aimr-voice-button').click();
                    await new Promise(resolve=>setTimeout(resolve,30));
                    const pending = input.node.querySelector('.aimr-voice-button');
                    const progress = pending.disabled && pending.getAttribute('aria-busy')==='true'
                        && !!pending.querySelector('.codicon-modifier-spin') && editor.getValue()==='Typed draft: ';
                    pending.click(); // A repeated stop must not start another operation.
                    finishTranscription();
                    await new Promise(resolve=>setTimeout(resolve,60));
                    const text = editor.getValue();
                    const released = input.node.querySelector('.aimr-voice-button').getAttribute('aria-pressed');
                    const ready = !input.node.querySelector('.aimr-voice-button').disabled;
                    input.update();
                    await new Promise(resolve=>setTimeout(resolve,60));
                    const toolbar = input.node.querySelector('.theia-ChatInputOptions-right');
                    const microphone = toolbar.querySelector('.aimr-voice-slot');
                    const send = toolbar.querySelector('.codicon-send').closest('.option');
                    return {subclass:input.constructor.name,text,toggles,latched,released,progress,ready,buttons:toolbar.querySelectorAll('.aimr-voice-button').length,
                        beforeSend:!!(microphone.compareDocumentPosition(send)&Node.DOCUMENT_POSITION_FOLLOWING),
                        requestsAdded:input._chatModel.getRequests().length-requests};
                } finally {finishTranscription();start.dispose();stop.dispose();editor.setValue(original);if(selection)editor.setSelection(selection);}
            });
            assert.deepEqual(result,{subclass:'AIMRChatInputWidget',text:'Typed draft: Dictated text.',toggles:2,latched:'true',released:'false',progress:true,ready:true,buttons:1,beforeSend:true,requestsAdded:0});
        } finally {await browser.disconnect();}
    });
});
