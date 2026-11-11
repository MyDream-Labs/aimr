/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
const { existsSync } = require('fs');
const { dirname, join } = require('path');
const { execFileSync } = require('child_process');

// Yarn can remove this N-API addon while retaining the native rebuild cache.
const directory = dirname(require.resolve('@theia/ffmpeg/package.json'));
if (!existsSync(join(directory, 'build/Release/ffmpeg.node'))) {
    execFileSync(process.execPath, [require.resolve('node-gyp/bin/node-gyp.js'), 'rebuild', '--directory', directory], { stdio: 'inherit' });
}
