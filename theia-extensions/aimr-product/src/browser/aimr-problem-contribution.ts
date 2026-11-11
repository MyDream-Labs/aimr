/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
import { injectable } from '@theia/core/shared/inversify';
import { ProblemContribution } from '@theia/markers/lib/browser/problem/problem-contribution';

@injectable()
export class AIMRProblemContribution extends ProblemContribution {
    override initializeLayout(): Promise<void> {
        // Keep native commands and saved layouts; do not open Problems in a new workspace.
        return Promise.resolve();
    }
}
