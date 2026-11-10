#!/usr/bin/env node

/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

// Render favicon.svg directly. Pillow only packages the rendered pixels into ICO/ICNS/BMP.
// Requires Python 3 with Pillow. Usage: yarn icons:generate [--color '#1c211f']
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseArgs } = require('util');
const { Resvg } = require('@resvg/resvg-js');

const root = path.resolve(__dirname, '..');
const { values } = parseArgs({ options: { color: { type: 'string' }, help: { type: 'boolean' } } });
if (values.help) {
    console.log("Usage: yarn icons:generate [--color '#RRGGBB']\nOmit --color to preserve favicon.svg colors.");
    process.exit(0);
}
if (values.color && !/^#[0-9a-f]{6}$/i.test(values.color)) {
    throw new Error('--color must be a hex color such as #1c211f');
}
// Check the converter before updating any assets.
execFileSync('python3', ['-c', 'from PIL import Image']);
let svg = fs.readFileSync(path.join(root, 'theia-extensions/aimr-product/resources/favicon.svg'), 'utf8');
if (values.color) {
    svg = svg.replace(/\b(fill|stroke)="#[0-9a-f]+"/gi, (_, attribute) => `${attribute}="${values.color}"`);
}
function write(relativePath, data) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
}
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
const productIcons = 'theia-extensions/aimr-product/src/browser';
write(`${productIcons}/icons/aimr-icon.svg`, svg);
write(`${productIcons}/aimr-icon.svg`, svg);
write(`${productIcons}/icons/aimr-icon.png`, png);
write('theia-extensions/aimr-product/resources/preload.html', `<style>
    .theia-preload {
        position: absolute; inset: 0; display: grid; place-items: center;
        background: #fff; color: #111; font-family: Arial, sans-serif;
    }
    .theia-preload::after { content: none; }
    .aimr-loading { text-align: center; }
    .aimr-loading svg { display: block; width: 84px; height: 84px; margin: auto; }
    .aimr-loading p { margin: 26px 0 0; font-size: 30px; font-weight: 600; }
</style>
<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">
<div class="aimr-loading" role="status" aria-label="Loading AIMR">${svg}<p>AIMR</p></div>
`);
for (const app of ['electron', 'electron-next']) {
    for (const name of ['512x512.png', 'LinuxLauncherIcons/512x512.png', 'WindowIcon/512-512.png']) {
        write(`applications/${app}/resources/icons/${name}`, png);
    }
    const splashIcon = svg.replace('<svg ', '<svg x="181" y="63" width="84" height="84" ');
    write(`applications/${app}/resources/AIMRSplash.svg`,
        '<svg xmlns="http://www.w3.org/2000/svg" width="446" height="276" viewBox="0 0 446 276">\n'
        + '<rect width="446" height="276" fill="#f5f5f5"/>\n' + splashIcon
        + '\n<text x="223" y="184" fill="#111111" font-family="Arial,sans-serif" font-size="30" '
        + 'font-weight="600" text-anchor="middle">AIMR</text>\n</svg>\n');
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'aimr-icons-'));
try {
    const master = path.join(temp, 'icon.png');
    fs.writeFileSync(master, new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng());
    execFileSync('python3', ['-c', `
from pathlib import Path
from PIL import Image
import sys
root = Path(sys.argv[1])
image = Image.open(sys.argv[2])
for name in ['applications/browser/ico/favicon.ico', 'applications/electron/resources/icon.ico',
             'applications/electron/resources/icons/WindowsLauncherIcons/TheiaIDE.ico',
             'applications/electron-next/resources/icon.ico']:
    target = root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, format='ICO', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
for name in ['applications/electron/resources/icon.icns',
             'applications/electron/resources/icons/MacLauncherIcons/icon.icns']:
    image.save(root / name, format='ICNS')
for app in ['electron', 'electron-next']:
    canvas = Image.new('RGB', (164,314), 'white')
    mark = image.resize((110,110), Image.Resampling.LANCZOS)
    canvas.paste(mark, (27,70), mark)
    target = root / 'applications' / app / 'resources/icons/InstallerSidebarImage/164-314Windows.bmp'
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target)
`, root, master], { stdio: 'inherit' });
} finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
console.log(`Generated AIMR assets from favicon.svg (${values.color || 'original colors'}).`);
