import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { connectIDE } from './browser-fixture.mjs';

describe('AIMR voice defaults', () => {
    it('reuses only the pinned Transformers runtime and reinstalls other cached versions', async function () {
        let source;
        try {source=readFileSync(new URL('../../../plugins/natearcher-ai.voxpilot/extension/dist/aimr-extension.js',import.meta.url),'utf8');}
        catch(error) {if(error.code==='ENOENT'){this.skip();return;}throw error;}
        const body=source.match(/async ensureOnnxRuntime\(\) \{([\s\S]*?)\n  \}\n  getOnnxRuntimePath/);
        assert.ok(body,'Pinned VoxPilot runtime loader changed');
        const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
        const ensure=new AsyncFunction('fs','path2','vscode','import_child_process2','ONNX_RUNTIME_VERSION',body[1]);
        for(const version of ['4.3.2','4.0.0']) {
            const installs=[];
            const fs={existsSync:()=>true,readFileSync:()=>JSON.stringify({version}),mkdirSync(){}};
            const vscode={ProgressLocation:{Notification:1},window:{withProgress:async(_,run)=>run()}};
            await ensure.call({runtimeDir:'/test/runtime'},fs,path,vscode,{execSync:command=>installs.push(command)},'1.17.0');
            assert.equal(installs.length,version==='4.3.2'?0:1);
            if(installs.length)assert.match(installs[0],/@huggingface\/transformers@4\.3\.2 --no-save/);
        }
    });
    it('bundles a pinned multilingual VoxPilot with an explicit fallback language and editable output', () => {
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
    it('reads the layout afresh and resolves its language through the real backend RPC', async () => {
        const {browser,page}=await connectIDE();
        try {
            const languages=await page.evaluate(async()=>{
                const {voice,commands,registry}=window.aimrTest;
                const original=voice.keyboard;
                if(registry.getToolName()!=='all')throw Error('Unexpected AI registry override');
                await commands.executeCommand('aimr.voice.state',{state:'idle'});
                let lang='ru',reads=0;
                voice.keyboard={layoutSource:'native-keymap',getNativeLayout:async()=>{reads++;return {info:{lang}};}};
                try {
                    const first=await commands.executeCommand('aimr.voice.language');lang='de';
                    const second=await commands.executeCommand('aimr.voice.language');
                    await voice.refreshLanguage();
                    await new Promise(resolve=>setTimeout(resolve,30));
                    const label=document.querySelector('.aimr-voice-language');
                    const icon=document.querySelector('.aimr-voice-button .codicon');
                    const labelBounds=label.getBoundingClientRect(),iconBounds=icon.getBoundingClientRect();
                    const sendBounds=document.querySelector('.theia-ChatInputOptions-right .codicon-send').getBoundingClientRect();
                    const visible=label.textContent==='de' && Math.abs(labelBounds.left-iconBounds.right)<1 && labelBounds.top>iconBounds.top
                        && Math.abs(iconBounds.top+iconBounds.height/2-sendBounds.top-sendBounds.height/2)<1;
                    const unchangedReads=reads;await voice.refreshLanguage();
                    return [first,second,unchangedReads,reads,visible];
                } finally {voice.keyboard=original;}
            });
            assert.deepEqual(languages,['ru','de',3,4,true]);
        } finally {await browser.disconnect();}
    });
    it('keeps Stop available during a pending Start reply and returns to an editable draft after Stop', async () => {
        const {browser,page}=await connectIDE();
        try {
            const result = await page.evaluate(async () => {
                const {shell,commands}=window.aimrTest;
                const input=shell.getWidgetById('chat-view-widget').inputWidget;
                const editor = input.editor.getControl();
                const enabled = input.isEnabled;
                input.setEnabled(true); // Exercise voice controls without requiring a configured model or credentials.
                const wait = async predicate => {
                    const deadline=Date.now()+3000;
                    while(!predicate()) {
                        if(Date.now()>deadline)throw Error('Voice UI did not settle');
                        await new Promise(resolve=>setTimeout(resolve,10));
                    }
                };
                await commands.executeCommand('aimr.voice.state',{state:'idle'});
                const original = editor.getValue(), selection = editor.getSelection();
                const requests = input._chatModel.getRequests().length;
                let toggles = 0, finishTranscription, finishStart;
                const startReply = new Promise(resolve=>{finishStart=resolve;});
                const transcription = new Promise(resolve=>{finishTranscription=resolve;});
                const start = commands.registerHandler('aimr.voice.startRecording',{execute:async()=>{
                    toggles++;
                    await commands.executeCommand('aimr.voice.state',{state:'recording'});
                    await startReply;
                    return {state:'recording'};
                }});
                const stop = commands.registerHandler('aimr.voice.stopRecording',{execute:async()=>{
                    toggles++;
                        await transcription;
                        await commands.executeCommand('workbench.action.chat.open',{query:'Dictated text.'});
                    return {state:'idle'};
                }});
                try {
                    await wait(()=>!input.node.querySelector('.aimr-voice-button').disabled);
                    editor.setValue('Typed draft: ');
                    editor.setPosition({lineNumber:1,column:14});
                    input.node.querySelector('.aimr-voice-button').click();
                    await wait(()=>input.node.querySelector('.aimr-voice-button').getAttribute('aria-pressed')==='true'
                        && !input.node.querySelector('.aimr-voice-button').disabled);
                    const latched = input.node.querySelector('.aimr-voice-button').getAttribute('aria-pressed');
                    input.node.querySelector('.aimr-voice-button').click();
                    await wait(()=>input.node.querySelector('.aimr-voice-button').getAttribute('aria-busy')==='true');
                    const pending = input.node.querySelector('.aimr-voice-button');
                    const progress = pending.disabled && pending.getAttribute('aria-busy')==='true'
                        && !!pending.querySelector('.codicon-modifier-spin') && editor.getValue()==='Typed draft: ';
                    pending.click(); // A repeated stop must not start another operation.
                    finishTranscription();
                    await wait(()=>!input.node.querySelector('.aimr-voice-button').disabled
                        && input.node.querySelector('.aimr-voice-button').getAttribute('aria-pressed')==='false');
                    finishStart(); // A late recording reply must not revive the stopped session.
                    input.update();
                    await new Promise(resolve=>setTimeout(resolve,60));
                    const text = editor.getValue();
                    const released = input.node.querySelector('.aimr-voice-button').getAttribute('aria-pressed');
                    const ready = !input.node.querySelector('.aimr-voice-button').disabled;
                    const toolbar = input.node.querySelector('.theia-ChatInputOptions-right');
                    const microphone = toolbar.querySelector('.aimr-voice-slot');
                    const send = toolbar.querySelector('.codicon-send').closest('.option');
                    return {productInput:input.voice===window.aimrTest.voice,text,toggles,latched,released,progress,ready,buttons:toolbar.querySelectorAll('.aimr-voice-button').length,
                        beforeSend:!!(microphone.compareDocumentPosition(send)&Node.DOCUMENT_POSITION_FOLLOWING),
                        requestsAdded:input._chatModel.getRequests().length-requests};
                } finally {
                    finishStart();finishTranscription();start.dispose();stop.dispose();
                    await commands.executeCommand('aimr.voice.state',{state:'idle'});
                    editor.setValue(original);if(selection)editor.setSelection(selection);
                    input.setEnabled(enabled);
                }
            });
            assert.deepEqual(result,{productInput:true,text:'Typed draft: Dictated text. ',toggles:2,latched:'true',released:'false',progress:true,ready:true,buttons:1,beforeSend:true,requestsAdded:0});
        } finally {await browser.disconnect();}
    });
});
