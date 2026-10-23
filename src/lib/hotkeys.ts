/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { Hotkey, RawHotkey } from "@tanstack/react-hotkeys";

/** Every verb an entity actions menu can offer. */
export type ActionVerb =
    | "create"
    | "update"
    | "delete"
    | "archive"
    | "restore"
    | "recover"
    | "publish"
    | "unpublish"
    | "unsubscribe"
    | "move"
    | "export"
    | "import"
    | "invite"
    | "link"
    | "unlink"
    | "make-owner"
    | "remove-owner"
    | "reopen"
    | "return"
    | "impersonate"
    | "promote"
    | "demote"
    | "ban"
    | "unban";

/**
 * Keyboard shortcut for the few common action verbs, app-wide (#380). Every other verb is reached
 * through the actions menu ({@link ACTIONS_MENU_HOTKEY}, arrows, Enter) rather than a key nobody
 * would remember; its menu item shows no shortcut badge.
 *
 * `Alt`-prefixing rather than a bare letter: the hotkey library's `ignoreInputs` already stops a
 * bare `E` firing inside a text field, but it would still fire when focus is on a button, link,
 * table row, or the page body. `Alt+<key>` requires intent.
 */
export const ActionHotkey: Partial<Record<ActionVerb, Hotkey>> = {
    create: "Alt+N",
    update: "Alt+E",
    delete: "Alt+Backspace",
    archive: "Alt+A",
};

/**
 * Open the page's actions menu with its first item focused (`Cmd+.` on Mac, `Ctrl+.` elsewhere),
 * as VS Code's Quick Fix menu does. Registered by `EntityActionMenu`, which only page-level menus
 * use. Deliberately not `Alt+<key>`: opening the menu isn't an action.
 */
export const ACTIONS_MENU_HOTKEY: Hotkey = "Mod+.";

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
