/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo, useState } from "react";

import { formatForDisplay, useHotkey, useHotkeyRegistrations } from "@tanstack/react-hotkeys";

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
 * `providers.tsx`). Lists the shortcuts currently active on the page — a
 * soft-disabled registration (wrong permission, wrong record status) is left
 * out — grouped by category.
 */
export function HotkeyHelp() {
    const [open, setOpen] = useState(false);

    useHotkey(HELP_HOTKEY, () => setOpen((v) => !v), { preventDefault: true });

    const { hotkeys } = useHotkeyRegistrations();

    const groups = useMemo(() => {
        const byCategory = new Map<string, { key: string; name: string }[]>();

        for (const reg of hotkeys) {
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
    }, [hotkeys]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Keyboard shortcuts</DialogTitle>
                    <DialogDescription>Shortcuts available on this page.</DialogDescription>
                </DialogHeader>

                {groups.length === 0 ? (
                    <p className="text-muted-foreground">No shortcuts on this page.</p>
                ) : (
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
                )}
            </DialogContent>
        </Dialog>
    );
}
