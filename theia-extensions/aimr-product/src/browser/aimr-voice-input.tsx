/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { AIChatInputWidget } from '@theia/ai-chat-ui/lib/browser/chat-input-widget';
import { ChatInputFocusService } from '@theia/ai-chat-ui/lib/browser/chat-input-focus-service';
import { ChatViewWidget } from '@theia/ai-chat-ui/lib/browser/chat-view-widget';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { Emitter } from '@theia/core/lib/common/event';
import { MessageService } from '@theia/core/lib/common/message-service';
import { inject, injectable } from '@theia/core/shared/inversify';
import * as React from '@theia/core/shared/react';
import { createPortal } from '@theia/core/shared/react-dom';
import { AIMRVoiceLanguage, voiceInsertion } from '../common/aimr-voice.js';
import { KeyboardLayoutProvider } from '@theia/core/lib/common/keyboard/keyboard-layout-provider';
import { HoverService } from '@theia/core/lib/browser/hover-service';

type VoiceState = 'idle' | 'starting' | 'recording' | 'transcribing';

@injectable()
export class AIMRVoiceContribution implements CommandContribution {
    @inject(CommandRegistry) protected readonly commands!: CommandRegistry;
    @inject(ApplicationShell) protected readonly shell!: ApplicationShell;
    @inject(ChatInputFocusService) protected readonly focus!: ChatInputFocusService;
    @inject(MessageService) protected readonly messages!: MessageService;
    @inject(AIMRVoiceLanguage) protected readonly language!: AIMRVoiceLanguage;
    @inject(KeyboardLayoutProvider) protected readonly keyboard!: KeyboardLayoutProvider;
    protected target: AIChatInputWidget | undefined;
    state: VoiceState = 'idle';
    currentLanguage: string | undefined;
    protected layoutKey: string | undefined;
    protected refreshingLanguage: Promise<void> | undefined;
    protected stateRevision = 0;
    protected readonly stateChanged = new Emitter<VoiceState>();
    readonly onDidChangeState = this.stateChanged.event;

    protected setState(state: VoiceState): void {
        if (state === 'idle' && this.state !== 'idle') { this.layoutKey = undefined; }
        this.state = state;
        this.stateRevision++;
        this.stateChanged.fire(state);
    }

    refreshLanguage(): Promise<void> {
        if (this.refreshingLanguage) { return this.refreshingLanguage; }
        if (this.state !== 'idle' || this.keyboard.layoutSource !== 'native-keymap') { return Promise.resolve(); }
        this.refreshingLanguage = (async () => {
            const { info } = await this.keyboard.getNativeLayout();
            const key = JSON.stringify(info);
            if (key === this.layoutKey) { return; }
            const language = await this.language.getLanguage(info);
            if (this.state !== 'idle') { return; }
            this.layoutKey = key;
            this.currentLanguage = language;
            this.stateChanged.fire(this.state);
        })().catch(() => {}).finally(() => { this.refreshingLanguage = undefined; });
        return this.refreshingLanguage;
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({ id: 'aimr.voice.language' }, { execute: async () =>
            this.keyboard.layoutSource === 'native-keymap' ? this.language.getLanguage((await this.keyboard.getNativeLayout()).info) : undefined });
        commands.registerCommand({ id: 'aimr.voice.state' }, {
            execute: ({ state, message, language }: { state: VoiceState; message?: string; language?: string }) => {
                if (language) { this.currentLanguage = language; }
                this.setState(state);
                if (message) { this.messages.error(message); }
            }
        });
        // VoxPilot's existing chat output command; keep transcripts as an editable draft.
        commands.registerCommand({ id: 'workbench.action.chat.open' }, {
            execute: ({ query }: { query?: string } = {}) => {
                const input = (this.target?.isDisposed ? undefined : this.target) ?? this.focus.getFocused()
                    ?? (this.shell.getWidgetById(ChatViewWidget.ID) as ChatViewWidget | undefined)?.inputWidget;
                const editor = input?.editor?.getControl();
                const selection = editor?.getSelection();
                if (!editor || !selection || input?.isDisposed) { throw new Error('Open the AI chat before dictating'); }
                const model = editor.getModel();
                if (typeof query === 'string' && query.trim() && model) {
                    const value = model.getValue();
                    const text = voiceInsertion(query, value.slice(0, model.getOffsetAt(selection.getStartPosition())),
                        value.slice(model.getOffsetAt(selection.getEndPosition())));
                    editor.executeEdits('aimr-voice', [{ range: selection, text, forceMoveMarkers: true }]);
                }
                editor.focus();
            }
        });
    }

    async toggle(input: AIChatInputWidget): Promise<void> {
        if (this.state === 'starting' || this.state === 'transcribing') { return; }
        const stopping = this.state === 'recording';
        if (!stopping) { this.target = input; input.editor?.focus(); }
        this.setState(stopping ? 'transcribing' : 'starting');
        const revision = this.stateRevision;
        try {
            const result = await this.commands.executeCommand<{ state: VoiceState }>(
                stopping ? 'aimr.voice.stopRecording' : 'aimr.voice.startRecording');
            // Notifications may already have completed this recording while a command reply was in flight.
            if (revision === this.stateRevision) { this.setState(result?.state ?? 'idle'); }
        } catch (error) {
            if (revision === this.stateRevision) { this.setState('idle'); }
            throw error;
        }
    }
}

@injectable()
export class AIMRChatInputWidget extends AIChatInputWidget {
    @inject(AIMRVoiceContribution) protected readonly voice!: AIMRVoiceContribution;

    protected override render(): React.ReactNode {
        return <>{super.render()}<VoiceButton node={this.node} enabled={this.isEnabled} voice={this.voice}
            hoverService={this.hoverService}
            toggle={() => this.voice.toggle(this)} onError={error => this.messageService.error(String(error))} /></>;
    }
}

function VoiceButton({ node, enabled, voice, hoverService, toggle, onError }: {
    node: HTMLElement; enabled: boolean; voice: AIMRVoiceContribution;
    hoverService: HoverService;
    toggle: () => Promise<void>; onError: (error: unknown) => unknown;
}): React.ReactNode {
    const [host, setHost] = React.useState<HTMLElement>();
    React.useSyncExternalStore(React.useCallback(listener => {
        const subscription = voice.onDidChangeState(listener);
        return () => subscription.dispose();
    }, [voice]), () => `${voice.state}:${voice.currentLanguage ?? ''}`);
    React.useEffect(() => {
        const refresh = () => {
            if (node.ownerDocument.visibilityState === 'visible' && node.ownerDocument.hasFocus()) { voice.refreshLanguage(); }
        };
        refresh();
        // Linux native-keymap has no layout-change events. Only resolve language when native info changes.
        const timer = window.setInterval(refresh, 1000);
        window.addEventListener('focus', refresh);
        return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, [voice, node]);
    React.useLayoutEffect(() => {
        // Theia has no input-action contribution yet. Keep this single DOM anchor isolated and tested.
        const toolbar = node.querySelector('.theia-ChatInputOptions-right');
        if (!toolbar) { return; }
        const slot = node.ownerDocument.createElement('span');
        slot.className = 'aimr-voice-slot';
        toolbar.insertBefore(slot, toolbar.querySelector('.option'));
        setHost(slot);
        return () => slot.remove();
    }, [node]);
    const recording = voice.state === 'recording';
    const transcribing = voice.state === 'transcribing';
    const starting = voice.state === 'starting';
    const title = transcribing ? 'Transcribing…'
        : recording ? `Stop recording and insert text${voice.currentLanguage ? ` (${voice.currentLanguage})` : ''}`
            : 'Start voice recording (keyboard language)';
    return host && createPortal(<button type='button' className='option aimr-voice-button' disabled={(!enabled && !recording) || starting || transcribing}
        aria-label={title} aria-busy={transcribing} aria-pressed={recording} data-active={recording}
        onMouseEnter={event => hoverService.requestHover({ content: title, target: event.currentTarget, position: 'top' })}
        onMouseDown={event => event.preventDefault()} onClick={async () => {
            try { await toggle(); } catch (error) { onError(error); }
        }}><span className={`codicon codicon-${transcribing ? 'loading codicon-modifier-spin' : recording ? 'primitive-square' : 'mic'}`} />
        <span className='aimr-voice-language' aria-hidden='true'>{voice.currentLanguage ?? '—'}</span>
    </button>, host);
}
