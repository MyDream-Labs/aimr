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

type VoiceState = 'idle' | 'recording' | 'transcribing';

@injectable()
export class AIMRVoiceContribution implements CommandContribution {
    @inject(CommandRegistry) protected readonly commands!: CommandRegistry;
    @inject(ApplicationShell) protected readonly shell!: ApplicationShell;
    @inject(ChatInputFocusService) protected readonly focus!: ChatInputFocusService;
    @inject(MessageService) protected readonly messages!: MessageService;
    protected target: AIChatInputWidget | undefined;
    state: VoiceState = 'idle';
    protected readonly stateChanged = new Emitter<VoiceState>();
    readonly onDidChangeState = this.stateChanged.event;

    protected setState(state: VoiceState): void {
        this.state = state;
        this.stateChanged.fire(state);
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand({ id: 'aimr.voice.state' }, {
            execute: ({ state, message }: { state: VoiceState; message?: string }) => {
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
                if (typeof query === 'string' && query) {
                    editor.executeEdits('aimr-voice', [{ range: selection, text: query, forceMoveMarkers: true }]);
                }
                editor.focus();
            }
        });
    }

    async toggle(input: AIChatInputWidget): Promise<void> {
        if (this.state === 'transcribing') { return; }
        const stopping = this.state === 'recording';
        if (!stopping) { this.target = input; input.editor?.focus(); }
        if (stopping) { this.setState('transcribing'); }
        try {
            const result = await this.commands.executeCommand<{ state: VoiceState }>(
                stopping ? 'aimr.voice.stopRecording' : 'aimr.voice.startRecording');
            this.setState(result?.state ?? 'idle');
        } catch (error) { this.setState('idle'); throw error; }
    }
}

@injectable()
export class AIMRChatInputWidget extends AIChatInputWidget {
    @inject(AIMRVoiceContribution) protected readonly voice!: AIMRVoiceContribution;

    protected override render(): React.ReactNode {
        return <>{super.render()}<VoiceButton node={this.node} enabled={this.isEnabled} voice={this.voice}
            toggle={() => this.voice.toggle(this)} onError={error => this.messageService.error(String(error))} /></>;
    }
}

function VoiceButton({ node, enabled, voice, toggle, onError }: {
    node: HTMLElement; enabled: boolean; voice: AIMRVoiceContribution;
    toggle: () => Promise<void>; onError: (error: unknown) => unknown;
}): React.ReactNode {
    const [host, setHost] = React.useState<HTMLElement>();
    const [busy, setBusy] = React.useState(false);
    const [state, setState] = React.useState(voice.state);
    React.useEffect(() => {
        const listener = voice.onDidChangeState(setState);
        return () => listener.dispose();
    }, [voice]);
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
    const recording = state === 'recording';
    const transcribing = state === 'transcribing';
    const title = transcribing ? 'Transcribing…'
        : recording ? 'Stop recording and insert text' : 'Start voice recording (English)';
    return host && createPortal(<button type='button' className='option aimr-voice-button' disabled={!enabled || busy || transcribing}
        title={title} aria-label={title} aria-busy={transcribing} aria-pressed={recording} data-active={recording}
        onMouseDown={event => event.preventDefault()} onClick={async () => {
            setBusy(true);
            try { await toggle(); } catch (error) { onError(error); } finally { setBusy(false); }
        }}><span className={`codicon codicon-${transcribing ? 'loading codicon-modifier-spin' : recording ? 'primitive-square' : 'mic'}`} />
    </button>, host);
}
