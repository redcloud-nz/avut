/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useHotkeys } from "@tanstack/react-hotkeys";

import { ActionHotkey, ActionVerb } from "@/lib/hotkeys";

export interface ActionHotkeyEntry {
    /** Action verb — determines the key via the {@link ActionHotkey} registry. */
    verb: ActionVerb;
    /** Invoked when the shortcut fires (open a dialog, run a mutation, …). */
    run: () => void;
    /** Soft-disable — the registration stays (and shows in the help overlay's
     *  hidden set) but the callback doesn't run. Defaults to `true`. */
    enabled?: boolean;
    /** Row label in the help overlay, e.g. "Edit". */
    name: string;
    /** Group heading in the help overlay, e.g. "Person". */
    category?: string;
}

/**
 * Register a set of action shortcuts for the current page/menu. Thin wrapper over
 * the hotkey library's array form — a single hook call, safe with a
 * variable-length list. Callbacks are synced every render, so closures stay
 * fresh.
 */
export function useActionHotkeys(entries: ActionHotkeyEntry[]): void {
    useHotkeys(
        entries.map(({ verb, run, enabled = true, name, category }) => ({
            hotkey: ActionHotkey[verb],
            callback: () => run(),
            options: { enabled, preventDefault: true, meta: { name, category } },
        })),
    );
}
