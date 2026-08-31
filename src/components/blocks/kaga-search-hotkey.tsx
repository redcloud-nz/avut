/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useHotkey } from "@tanstack/react-hotkeys";

import { SEARCH_HOTKEY } from "@/lib/hotkeys";

/**
 * Registers `/` to focus the Kaga table search input. Rendered once by
 * `KagaTableToolbar`, so every Kaga table gets it. Split into its own client
 * component to keep `kaga.tsx` hook-free.
 *
 * The single `/` key means the library's `ignoreInputs` default already keeps it
 * from firing while another field is focused; `preventDefault` stops the `/`
 * landing in the input once focused.
 */
export function KagaSearchHotkey() {
    useHotkey(
        SEARCH_HOTKEY,
        () => {
            document
                .querySelector<HTMLInputElement>(
                    '[data-slot="table-toolbar"] [data-slot="input-group-control"]',
                )
                ?.focus();
        },
        { preventDefault: true, meta: { name: "Focus search", category: "Table" } },
    );

    return null;
}
