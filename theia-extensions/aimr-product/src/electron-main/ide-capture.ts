/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { BrowserWindow, webContents } from '@theia/electron/shared/electron';
import { injectable } from '@theia/core/shared/inversify';
import { CaptureRect, IDECapture } from '../common/ide-screenshot.js';

@injectable()
export class IDECaptureService implements IDECapture {
    async capture(webContentsId: number, rect?: CaptureRect): Promise<string> {
        const contents = webContents.fromId(webContentsId);
        const window = contents && BrowserWindow.fromWebContents(contents);
        if (!contents || !window || !window.isVisible() || window.isMinimized()) { throw new Error('IDE window is not visible'); }
        // DOM bounds are CSS pixels; capturePage expects device-independent pixels at the current zoom.
        const zoom = contents.getZoomFactor();
        const bounds = rect && { x: Math.floor(rect.x * zoom), y: Math.floor(rect.y * zoom),
            width: Math.ceil((rect.x + rect.width) * zoom) - Math.floor(rect.x * zoom),
            height: Math.ceil((rect.y + rect.height) * zoom) - Math.floor(rect.y * zoom) };
        const image = await contents.capturePage(bounds);
        if (image.isEmpty()) { throw new Error('IDE capture is empty'); }
        return image.toPNG({ scaleFactor: Math.max(...image.getScaleFactors()) }).toString('base64');
    }
}
