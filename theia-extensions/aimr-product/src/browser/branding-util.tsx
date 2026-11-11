/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { codicon } from '@theia/core/lib/browser';
import * as React from '@theia/core/shared/react';

export function renderProductName(showMark = true): React.ReactNode {
    return <h1><span className="aimr-branding-accent">{showMark ? '⌖' : ''}AIMR</span></h1>;
}

function BrowserLink({ text, url }: { text: string; url: string }): React.JSX.Element {
    return <a href={url} target='_blank' rel='noreferrer'>{text}</a>;
}

function Description(): React.JSX.Element {
    return <>
        <h3 className='gs-section-header'><i className={codicon('info')}></i>About AIMR</h3>
        <p>
            An AI-powered workspace for work and business. Describe a goal, then shape tools, interfaces
            and workflows around the work you need to do.
        </p>
        <p><BrowserLink text='Set Goal. Aim. Reach.' url='https://aimr.site' /></p>
    </>;
}

function DeveloperCredit(): React.JSX.Element {
    return <p>Developed by MyDream Labs LLC. <BrowserLink text='aimr.site' url='https://aimr.site' /></p>;
}

export function renderAboutSections(): React.ReactNode {
    return <>
        <div className='gs-section'><Description /></div>
        <div className='gs-section'>
            <h3 className='gs-section-header'><i className={codicon('extensions')}></i>Built on Eclipse Theia</h3>
            <p>
                AIMR is built on the <BrowserLink text='Eclipse Theia platform' url='https://theia-ide.org' />.
                The platform and included extensions provide the underlying IDE capabilities.
            </p>
            <DeveloperCredit />
        </div>
    </>;
}

export function renderWelcomeCredits(): React.ReactNode {
    return <div className='gs-section'><Description /><DeveloperCredit /></div>;
}
