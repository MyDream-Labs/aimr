/********************************************************************************
 * Copyright (C) 2026 MyDream Labs LLC.
 * SPDX-License-Identifier: MIT
 ********************************************************************************/
export const IDE_SERVER = {
    name: 'IDE Control — AIMR', version: '1.0.0',
    description: 'Inspect and control the running AIMR IDE: settings, commands, extensions, panels and tabs.'
};
export const IDE_INSTRUCTIONS = 'Use this server to inspect or change the running IDE. Search settings and commands before using unfamiliar IDs. '
    + 'Inspect current state before changing it and verify the result afterward. Tools operate on this IDE instance, not the operating system. '
    + 'Some operations may require a native confirmation or reload. Start pagination at offset 0 when changing the query. Only one MCP client is supported at a time.';
