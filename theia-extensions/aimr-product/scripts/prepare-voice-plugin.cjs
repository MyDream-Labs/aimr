/* Copyright (C) 2026 MyDream Labs LLC. SPDX-License-Identifier: MIT */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../../plugins/natearcher-ai.voxpilot/extension');
// A clean checkout downloads plugins after building extensions.
if (!fs.existsSync(root)) { process.exit(0); }
const source = fs.readFileSync(path.join(root, 'dist/extension.js'), 'utf8');
if (createHash('sha256').update(source).digest('hex') !== '996365a5e08ed46b4085c3cdf3e65e68dcab584cc2c27ae0a1d1aed824827b4c') {
    throw new Error('VoxPilot source changed; review and test the AIMR manual-input integration before updating');
}
const file = path.join(root, 'package.json');
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
manifest.version = '0.7.1-aimr.2';
manifest.displayName = 'VoxPilot for AIMR';
manifest.repository = { type: 'git', url: 'https://github.com/MyDream-Labs/aimr.git' };
manifest.bugs = { url: 'https://github.com/MyDream-Labs/aimr/issues' };
manifest.main = './dist/aimr-extension.js';
for (const [command, title] of [['aimr.voice.startRecording', 'Start voice recording'], ['aimr.voice.stopRecording', 'Stop voice recording']]) {
    if (!manifest.contributes.commands.some(item => item.command === command)) { manifest.contributes.commands.push({ command, title }); }
}
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
fs.copyFileSync(path.resolve(__dirname, '../resources/voice/manual-input.cjs'), path.join(root, 'dist/aimr-manual-input.cjs'));
// Let the existing Transformers pipeline handle long recordings and overlap merging.
const transformersVersion = '4.3.2';
const adapted = source.replace('const opts = { sampling_rate: 16e3 };',
    "const opts = { sampling_rate: 16e3, ...(this._isWhisperModel ? { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 } : {}) };")
    .replace('@huggingface/transformers --no-save', `@huggingface/transformers@${transformersVersion} --no-save`)
    .replace('fs.existsSync(path2.join(transformersDir, "package.json"))) {',
        `fs.existsSync(path2.join(transformersDir, "package.json")) && JSON.parse(fs.readFileSync(path2.join(transformersDir, "package.json"), "utf8")).version === "${transformersVersion}") {`);
fs.writeFileSync(path.join(root, 'dist/aimr-extension.js'), adapted + `
// AIMR manual-input integration. Original extension.js and its MIT license are preserved.
const activateUpstream = activate;
activate = async function(context) {
    const api = await activateUpstream(context);
    require('./aimr-manual-input.cjs')(engine, context, vscode12);
    return api;
};
`);
console.log('Prepared VoxPilot for AIMR: manual multilingual input');
