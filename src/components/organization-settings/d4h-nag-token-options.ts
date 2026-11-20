/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * The org's D4H access tokens the reminders module can use: those on the server its D4H link
 * uses (decision 3 of the d4h-nag plan). None without an org-level D4H link, since there's then
 * no server to match and no team to remind. Shared by the settings card's token row and its
 * dialog, so both judge the stored token the same way.
 */
export function d4hNagTokenOptions<T extends { serverCode: string }>(
    tokens: readonly T[],
    orgD4H: { serverCode: string } | null,
): T[] {
    return orgD4H ? tokens.filter((token) => token.serverCode === orgD4H.serverCode) : [];
}
