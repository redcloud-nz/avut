/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { formatForDisplay, type RegisterableHotkey } from "@tanstack/react-hotkeys";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

// A char that never appears in a formatted token, so we can split the display
// string back into its individual keys.
const TOKEN_SEP = "␟";

/**
 * Renders a hotkey as one `<Kbd>` per key — `<KbdGroup>`-wrapped when it's a
 * combo. Platform-aware via `formatForDisplay` (⌥ N on macOS, Alt N elsewhere).
 */
export function HotkeyKbd({ hotkey }: { hotkey: RegisterableHotkey }) {
    const tokens = formatForDisplay(hotkey, { separatorToken: TOKEN_SEP }).split(TOKEN_SEP);

    if (tokens.length === 1) return <Kbd>{tokens[0]}</Kbd>;

    return (
        <KbdGroup>
            {tokens.map((token, i) => (
                <Kbd key={i}>{token}</Kbd>
            ))}
        </KbdGroup>
    );
}
