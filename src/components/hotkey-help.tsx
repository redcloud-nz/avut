/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo, useState } from "react";

import { formatForDisplay, getHotkeyManager, useHotkey } from "@tanstack/react-hotkeys";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { HELP_HOTKEY } from "@/lib/hotkeys";

/**
 * The `?` keyboard-shortcuts help overlay. Mounted once, app-wide (in
 * `providers.tsx`).
 *
 * This component only *registers* the `?` hotkey and owns the open state. It
 * must NOT observe the hotkey-manager store: `useHotkey` writes to that store
 * during render (a fresh options object every render), so a live subscription
 * (`useHotkeyRegistrations`) mounted alongside it gets updated mid-render —
 * React's "cannot update a component while rendering another" — and, if the same
 * component both subscribes and registers, it re-renders forever. So the list
 * takes a one-time snapshot of the registrations when the dialog opens instead.
 */
export function HotkeyHelp() {
    const [open, setOpen] = useState(false);

    useHotkey(HELP_HOTKEY, () => setOpen((v) => !v), {
        preventDefault: true,
        meta: { name: "Show keyboard shortcuts", category: "General" },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                    <DialogDescription>Shortcuts available on this page.</DialogDescription>
                </DialogHeader>
                {open && <HotkeyHelpList />}
            </DialogContent>
        </Dialog>
    );
}

/**
 * Lists the shortcuts active on the page when the overlay was opened — a
 * soft-disabled registration (wrong permission, wrong record status) is left
 * out — grouped by category. Snapshots the hotkey-manager store once on mount
 * rather than subscribing (see the note on {@link HotkeyHelp}).
 */
function HotkeyHelpList() {
    const groups = useMemo(() => {
        const byCategory = new Map<string, { key: string; name: string }[]>();

        for (const reg of getHotkeyManager().registrations.state.values()) {
            if (reg.options.enabled === false) continue;

            const category = reg.options.meta?.category ?? "General";
            const name = reg.options.meta?.name ?? formatForDisplay(reg.hotkey);

            const rows = byCategory.get(category) ?? [];
            rows.push({ key: formatForDisplay(reg.hotkey), name });
            byCategory.set(category, rows);
        }

        return [...byCategory.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, rows]) => ({
                category,
                rows: rows.sort((a, b) => a.name.localeCompare(b.name)),
            }));
        // Snapshot once — the overlay is short-lived and shortcuts don't change
        // while it's open.
    }, []);

    if (groups.length === 0) {
        return <p className="text-muted-foreground">No shortcuts on this page.</p>;
    }

    return (
        <div className="flex flex-col gap-4">
            {groups.map(({ category, rows }) => (
                <div key={category} className="flex flex-col gap-1">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase">
                        {category}
                    </h3>
                    {rows.map(({ key, name }) => (
                        <div
                            key={`${key}:${name}`}
                            className="flex items-center justify-between gap-4 py-0.5"
                        >
                            <span>{name}</span>
                            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                                {key}
                            </kbd>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
