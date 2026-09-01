/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { formatForDisplay, type RegisterableHotkey } from "@tanstack/react-hotkeys";

import { Kbd, KbdGroup } from "@/components/ui/kbd";

// A char that never appears in a formatted token, so we can split the display
// string back into its individual keys.
const TOKEN_SEP = "␟";

// Wider than the default `min-w-5` so glyphs of varying width (a letter vs ⌫ or
// ⇧) all sit in a same-size cap — keys line up across rows.
const CAP = "min-w-6";

/**
 * Renders a hotkey as one `<Kbd>` per key — `<KbdGroup>`-wrapped when it's a
 * combo. Platform-aware via `formatForDisplay` (⌥ N on macOS, Alt N elsewhere).
 */
export function HotkeyKbd({ hotkey }: { hotkey: RegisterableHotkey }) {
    const tokens = formatForDisplay(hotkey, { separatorToken: TOKEN_SEP }).split(TOKEN_SEP);

    if (tokens.length === 1) return <Kbd className={CAP}>{tokens[0]}</Kbd>;

    return (
        <KbdGroup>
            {tokens.map((token, i) => (
                <Kbd key={i} className={CAP}>
                    {token}
                </Kbd>
            ))}
        </KbdGroup>
    );
}
