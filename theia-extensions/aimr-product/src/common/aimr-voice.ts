/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import type { IKeyboardLayoutInfo } from 'native-keymap';

export const AIMRVoiceLanguage = Symbol('AIMRVoiceLanguage');
export const AIMR_VOICE_LANGUAGE_PATH = '/services/aimr/voice-language';
export interface AIMRVoiceLanguage {
    getLanguage(info: IKeyboardLayoutInfo): Promise<string | undefined>;
}

export function voiceInsertion(query: string, before: string, after: string): string {
    const text = query.trim();
    return text ? `${before && !/\s$/.test(before) ? ' ' : ''}${text}${/^\s/.test(after) ? '' : ' '}` : '';
}
