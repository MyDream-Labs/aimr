/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
export const IDE_SCREENSHOT_PATH = '/services/ide-screenshot';
export const IDE_CAPTURE_PATH = '/services/ide-capture';

export interface CaptureRect { x: number; y: number; width: number; height: number }
export const IDECapture = Symbol('IDECapture');
export interface IDECapture {
    capture(webContentsId: number, rect?: CaptureRect): Promise<string>;
}
export type ScreenshotResult = { data: string } | { error: string; message?: string; widgets?: Record<string, string> };
export interface IDEScreenshotClient {
    capture(widgetId?: string): Promise<ScreenshotResult>;
}
