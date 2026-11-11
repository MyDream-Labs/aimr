/********************************************************************************
 * Copyright (C) 2020 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import * as React from '@theia/core/shared/react';

import { PreferenceService } from '@theia/core/lib/common';
import { inject, injectable } from '@theia/core/shared/inversify';
import { renderProductName, renderWelcomeCredits } from './branding-util.js';

import { GettingStartedWidget } from '@theia/getting-started/lib/browser/getting-started-widget';
import { VSXEnvironment } from '@theia/vsx-registry/lib/common/vsx-environment';

@injectable()
export class AIMRGettingStartedWidget extends GettingStartedWidget {

    @inject(VSXEnvironment)
    protected readonly vsxEnvironment!: VSXEnvironment;

    @inject(PreferenceService)
    protected readonly preferenceService!: PreferenceService;

    protected vscodeApiVersion!: string;

    protected async doInit(): Promise<void> {
        super.doInit();
        // Brand the tab with the application icon, the way a favicon marks a page.
        this.title.iconClass = 'aimr-welcome-tab-icon';
        this.vscodeApiVersion = await this.vsxEnvironment.getVscodeApiVersion();
        await this.preferenceService.ready;
        this.update();
    }

    protected render(): React.ReactNode {
        if (this.walkthroughService.selectedWalkthrough) {
            return this.renderSelectedWalkthrough();
        }
        return <div className='gs-container'>
            <div className='gs-content-container'>
                {this.renderHeader()}
                <hr className='gs-hr' />
                {/*
                  * The walkthroughs take the row the AI banner used to have, since they now carry the AI
                  * onboarding it announced. The section renders nothing once no walkthrough is pending, and the
                  * row then collapses with it, leaving the two columns to themselves.
                  */}
                <div className='aimr-welcome-walkthroughs'>
                    {this.renderWalkthroughs()}
                </div>
                <div className='aimr-welcome-grid'>
                    <div className='aimr-welcome-column'>
                        {this.renderStart()}
                        {this.renderRecentWorkspaces()}
                        {this.renderSettings()}
                        {this.renderHelp()}
                    </div>
                    <div className='aimr-welcome-column'>
                        {renderWelcomeCredits()}
                    </div>
                </div>
            </div>
            <div className='gs-preference-container'>
                {this.renderPreferences()}
            </div>
        </div>;
    }

    /**
     * The square application icon is used rather than the wordmark logo: it carries the brand without
     * repeating the product name next to it, and the same box fits every branding variant.
     */
    protected renderHeader(): React.ReactNode {
        return <div className='gs-header aimr-welcome-header'>
            <div className='theia-icon aimr-welcome-icon'>
            </div>
            <div>
                {renderProductName(false)}
                {this.renderVersion()}
            </div>
        </div>;
    }

    /**
     * Both versions go on a single line, so that the header stays as flat as the sections below it.
     */
    protected renderVersion(): React.ReactNode {
        return <p className='gs-sub-header'>
            {'Version ' + (this.applicationInfo?.version ?? '-') + ' · VS Code API ' + (this.vscodeApiVersion ?? '-')}
        </p>;
    }
}
