import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const attach = createRequire(import.meta.url)('../resources/voice/manual-input.cjs');
const deferred = () => {let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
const tick = () => new Promise(resolve=>setTimeout(resolve,0));

function fixture(loading = Promise.resolve()) {
    const handlers = new Map(), states = [], deliveries = [], requests = [];
    let loads = 0, capturing = false;
    const audio = new EventEmitter();
    audio.start=()=>{capturing=true;};audio.stop=()=>{capturing=false;};
    const transcriber={transcribe:async(pcm,language)=>{requests.push({pcm,language});return {text:' Transcript. '};},dispose:()=>{}};
    const engine={audio,isListening:false,speechBuffer:[],segmentTranscripts:[],
        statusBar:{setDictating(){},setIdle(){}},history:{add(){}},
        onAudioChunk(){throw Error('Manual capture reached the upstream VAD pipeline');},
        ensureTranscriber:async()=>{loads++;await (typeof loading==='function'?loading(loads):loading);engine.transcriber=transcriber;}};
    const context={subscriptions:[]};
    const api={commands:{
        registerCommand:(id,handler)=>{handlers.set(id,handler);return {dispose:()=>handlers.delete(id)};},
        executeCommand:async(id,args)=>{
            if(id==='aimr.voice.state')states.push(args);
            else if(id==='workbench.action.chat.open')deliveries.push(args);
            else throw Error('Unexpected command '+id);
        }
    }};
    attach(engine,context,api);
    return {engine,api,states,deliveries,requests,transcriber,get loads(){return loads;},get capturing(){return capturing;},
        start:()=>handlers.get('aimr.voice.startRecording')(),stop:()=>handlers.get('aimr.voice.stopRecording')()};
}

describe('AIMR manual voice engine', () => {
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
