import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const attach = createRequire(import.meta.url)('../resources/voice/manual-input.cjs');
const deferred = () => {let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const tick = () => new Promise(resolve=>setTimeout(resolve,0));

function fixture(loading = Promise.resolve()) {
    const handlers = new Map(), states = [], deliveries = [], requests = [];
    let language = 'en';
    let loads = 0, capturing = false;
    const audio = new EventEmitter();
    audio.start=()=>{capturing=true;};audio.stop=()=>{capturing=false;};
    const transcriber={transcribe:async(pcm,language)=>{requests.push({pcm,language});return {text:' Transcript. '};},dispose:()=>{}};
    const engine={audio,isListening:false,speechBuffer:[],segmentTranscripts:[],
        statusBar:{setDictating(){},setIdle(){}},history:{add(){}},
        onAudioChunk(){throw Error('Manual capture reached the upstream VAD pipeline');},
        ensureTranscriber:async()=>{loads++;await (typeof loading==='function'?loading(loads):loading);engine.transcriber=transcriber;}};
    const context={subscriptions:[]};
    const api={workspace:{getConfiguration:()=>({get:()=> 'en'})},commands:{
        registerCommand:(id,handler)=>{handlers.set(id,handler);return {dispose:()=>handlers.delete(id)};},
        executeCommand:async(id,args)=>{
            if(id==='aimr.voice.state')states.push(args);
            else if(id==='aimr.voice.language')return language;
            else if(id==='workbench.action.chat.open')deliveries.push(args);
            else throw Error('Unexpected command '+id);
        }
    }};
    attach(engine,context,api);
    return {engine,api,states,deliveries,requests,transcriber,set language(value){language=value;},get loads(){return loads;},get capturing(){return capturing;},
        start:()=>handlers.get('aimr.voice.startRecording')(),stop:()=>handlers.get('aimr.voice.stopRecording')()};
}

describe('AIMR manual voice engine', () => {
    it('returns to idle after immediate Stop with no audio while the first model load is pending', async () => {
        const model=deferred(),f=fixture(model.promise);
        await f.start();const stopping=f.stop();
        assert.equal(f.capturing,false);await tick();
        assert.equal(f.states.at(-1).state,'transcribing');
        model.resolve();await stopping;
        assert.equal(f.states.at(-1).state,'idle');assert.equal(f.requests.length,0);
        await f.start();await f.stop();assert.equal(f.states.at(-1).state,'idle');assert.equal(f.loads,1);
    });
    it('captures before model preparation, releases the microphone on Stop and waits for delivery', async () => {
        const model=deferred(),asr=deferred(),delivery=deferred();
        const f=fixture(model.promise);
        f.transcriber.transcribe=async(pcm,language)=>{f.requests.push({pcm,language});return asr.promise;};
        const execute=f.api.commands.executeCommand;
        f.api.commands.executeCommand=async(id,args)=>{if(id==='workbench.action.chat.open')await delivery.promise;return execute(id,args);};
        assert.deepEqual(await f.start(),{state:'recording'});
        assert.equal(f.capturing,true);
        f.engine.onAudioChunk(Buffer.from([1,0,2,0]));
        const stopping=f.stop();
        assert.strictEqual(f.stop(),stopping);
        assert.equal(f.capturing,false);
        assert.equal(f.deliveries.length,0);
        model.resolve();await tick();
        assert.deepEqual(f.requests,[{pcm:Buffer.from([1,0,2,0]),language:'en'}]);
        asr.resolve({text:' Actual text. '});await tick();
        assert.equal(f.states.at(-1).state,'transcribing');
        delivery.resolve();await stopping;
        assert.deepEqual(f.deliveries,[{query:'Actual text.',isPartialQuery:true}]);
        assert.equal(f.states.at(-1).state,'idle');
    });
    it('records every frame on repeated cycles, keeps the model loaded and delivers once per Stop', async () => {
        const f=fixture();
        for(let i=1;i<=3;i++){
            await f.start();
            f.engine.onAudioChunk(Buffer.alloc(1920)); // Initial silence is retained, without calibration.
            f.engine.onAudioChunk(Buffer.from([i,0]));
            f.engine.onAudioChunk(Buffer.alloc(1920)); // Pauses never trigger ASR or delivery.
            await tick();assert.equal(f.requests.length,i-1);
            await f.stop();assert.equal(f.requests[i-1].pcm.length,3842);
            assert.equal(f.deliveries.length,i);
            f.engine.onAudioChunk(Buffer.from([99,0])); // Ignore late audio after Stop.
        }
        assert.equal(f.loads,1);
    });
    it('freezes the layout language per recording and reuses the multilingual model', async () => {
        const f=fixture();
        f.language='ru';await f.start();await tick();f.language='de';
        f.engine.onAudioChunk(Buffer.from([1,0]));await f.stop();
        await f.start();f.engine.onAudioChunk(Buffer.from([2,0]));await f.stop();
        assert.deepEqual(f.requests.map(request=>request.language),['ru','de']);
        assert.equal(f.loads,1);
    });
    it('records immediately while language detection is pending and falls back to the selected language', async () => {
        const f=fixture(),language=deferred(),execute=f.api.commands.executeCommand;
        f.api.workspace.getConfiguration=()=>({get:()=> 'fr'});
        f.api.commands.executeCommand=(id,args)=>id==='aimr.voice.language'?language.promise:execute(id,args);
        await f.start();assert.equal(f.capturing,true);
        f.engine.onAudioChunk(Buffer.from([1,0]));const stopping=f.stop();
        await tick();assert.equal(f.capturing,false);assert.equal(f.requests.length,0);
        language.reject(Error('Layout unavailable'));await stopping;
        assert.equal(f.requests[0].language,'fr');
    });
    it('recovers after ASR errors and handles an empty recording without stale text', async () => {
        const f=fixture();const decode=f.transcriber.transcribe;
        f.transcriber.transcribe=async()=>{throw Error('ASR failed');};
        await f.start();f.engine.onAudioChunk(Buffer.from([1,0]));
        await assert.rejects(f.stop(),/ASR failed/);
        assert.equal(f.capturing,false);assert.equal(f.states.at(-1).state,'idle');
        f.transcriber.transcribe=decode;
        await f.start();await f.stop();assert.equal(f.deliveries.length,0);
        await f.start();f.engine.onAudioChunk(Buffer.from([2,0]));await f.stop();
        assert.equal(f.deliveries.length,1);assert.equal(f.loads,1);
    });
    it('stops capture when model preparation fails and allows retry', async () => {
        const model=deferred(),f=fixture(load=>load===1?model.promise:Promise.resolve());
        await f.start();model.reject(Error('Model unavailable'));await tick();
        assert.equal(f.capturing,false);
        assert.match(f.states.at(-1).message,/Model unavailable/);
        assert.deepEqual(await f.stop(),{state:'idle'});
        await f.start();f.engine.onAudioChunk(Buffer.from([1,0]));await f.stop();
        assert.equal(f.deliveries.length,1);assert.equal(f.loads,2);
    });
});
