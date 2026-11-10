/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

export const AIMRAgentService = Symbol('AIMRAgentService');
export const AIMR_AGENT_SERVICE_PATH = '/services/aimr/agent';

export interface AIMRAgentService {
    isCodexInstalled(): Promise<boolean>;
}
