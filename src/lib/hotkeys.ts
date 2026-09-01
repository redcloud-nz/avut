/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { RawHotkey } from "@tanstack/react-hotkeys";

/**
 * Canonical keyboard shortcut for each action verb, app-wide. Every dialog
 * trigger is `Alt+<key>`; the two bare keys (`/`, `?`) are non-destructive and
 * follow near-universal web convention.
 *
 * `Alt`-prefixing rather than a bare letter: the hotkey library's `ignoreInputs`
 * already stops a bare `E` firing inside a text field, but it would still fire
 * when focus is on a button, link, table row, or the page body. `Alt+<key>`
 * requires intent.
 */
export const ActionHotkey = {
    create: "Alt+N",
    update: "Alt+E",
    delete: "Alt+Backspace",
    archive: "Alt+A",
    restore: "Alt+R",
    publish: "Alt+P",
    unpublish: "Alt+U",
    move: "Alt+M",
} as const satisfies Record<string, string>;

export type ActionVerb = keyof typeof ActionHotkey;

/** Focus the table search input. Owned by the Kaga table toolbar. */
export const SEARCH_HOTKEY = "/";

/**
 * Toggle the keyboard-shortcuts help overlay. `?` is Shift+/ on most layouts, so
 * the real keydown always carries Shift — the registration must expect it, or the
 * library's exact-modifier match (`event.shiftKey !== parsed.shift`) rejects it.
 */
export const HELP_HOTKEY: RawHotkey = { key: "?", shift: true };

declare module "@tanstack/hotkeys" {
    /** Group shortcuts in the help overlay by entity ("Person", "Team", …). */
    interface HotkeyMeta {
        category?: string;
    }
}
