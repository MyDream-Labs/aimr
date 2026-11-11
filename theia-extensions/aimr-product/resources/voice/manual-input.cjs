/* Copyright (C) 2026 MyDream Labs LLC. SPDX-License-Identifier: MIT */

// Attached only to the hash-checked VoxPilot build. Reuse its capture and ASR;
// keep manual audio outside its VAD/segmentation/finalization pipeline.
module.exports = function attachManualInput(engine, context, vscode) {
    let session, model;
    const notify = (state, message) => vscode.commands.executeCommand('aimr.voice.state', { state, message }).catch(() => {});
    const receive = engine.onAudioChunk.bind(engine);
    engine.onAudioChunk = chunk => {
        if (session) {
            if (session.state === 'recording') { session.chunks.push(Buffer.from(chunk)); }
        } else if (engine.isListening) { receive(chunk); }
    };
    function fail(current, error, report = true) {
        current.error = error;
        if (session === current && current.state === 'recording') {
            session = undefined;
            engine.audio.stop();
            engine.isListening = false;
            void notify('idle', report ? String(error.message ?? error) : undefined);
        }
    }
    async function start() {
        if (session) { return { state: session.state }; }
        const current = session = { state: 'recording', chunks: [] };
        engine.speechBuffer = [];
        engine.segmentTranscripts = [];
        engine.pendingAudio = Buffer.alloc(0);
        try {
            engine.audio.start(); // Capture first; model preparation never blocks recording.
            if (session !== current) { return { state: 'idle' }; }
            engine.isListening = true;
            engine.statusBar.setDictating();
        } catch (error) { fail(current, error); throw error; }
        if (!model) {
            model = engine.ensureTranscriber().catch(error => {
                engine.transcriber?.dispose();
                engine.transcriber = null;
                model = undefined;
                throw error;
            });
        }
        current.ready = model.then(() => undefined, error => { fail(current, error); return error; });
        await notify('recording');
        return { state: session === current ? current.state : 'idle' };
    }
    function stop() {
        const current = session;
        if (!current) { return Promise.resolve({ state: 'idle' }); }
        if (current.stopping) { return current.stopping; }
        current.state = 'transcribing';
        engine.audio.stop(); // Release the microphone before awaiting ASR or model loading.
        engine.isListening = false;
        current.stopping = (async () => {
            try {
                await notify('transcribing');
                const error = await current.ready;
                if (current.error || error) { throw current.error ?? error; }
                const pcm = Buffer.concat(current.chunks);
                current.chunks = [];
                if (pcm.length && pcm.some(byte => byte !== 0)) {
                    const result = await engine.transcriber.transcribe(pcm, 'en');
                    const text = result.text.trim();
                    if (text) {
                        await vscode.commands.executeCommand('workbench.action.chat.open', { query: text, isPartialQuery: true });
                        engine.lastTranscript = text;
                        engine.history.add(text);
                    }
                }
                return { state: 'idle' };
            } finally {
                if (session === current) { session = undefined; }
                engine.statusBar.setIdle();
                await notify('idle');
            }
        })();
        return current.stopping;
    }
    const onError = error => { if (session) { fail(session, error, false); } };
    const onStopped = code => {
        if (session?.state === 'recording' && code !== null) { fail(session, new Error('Microphone capture stopped unexpectedly')); }
    };
    engine.audio.on('error', onError);
    engine.audio.on('stopped', onStopped);
    const toggle = () => session ? stop() : start();
    engine.toggle = engine.toggleDictation = engine.quickCapture = toggle;
    context.subscriptions.push(
        vscode.commands.registerCommand('aimr.voice.startRecording', start),
        vscode.commands.registerCommand('aimr.voice.stopRecording', stop),
        { dispose() { session = undefined; engine.audio.stop(); engine.audio.off('error', onError); engine.audio.off('stopped', onStopped); } }
    );
};
