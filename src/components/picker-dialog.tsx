/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { useDismissedThisVisit } from "@/hooks/use-dismissed-this-visit";
import { cn } from "@/lib/utils";

/** What a `PickerDialog`'s children get, to call as the user picks. */
export interface PickerDialogControls {
    /**
     * Mark the dialog dismissed without touching the URL, so `forceOpen` can't hold it open.
     * Call it before navigating away with `router.push`: the navigation drops `?action=` along
     * with the rest of the query, and clearing `action` first could land a throttled nuqs write
     * on the new URL.
     */
    dismiss: () => void;
    /**
     * Dismiss and clear `?action=` (replacing the history entry), for a pick that stays on the
     * page and only writes its own search params. Write those first, in the same handler.
     */
    close: () => void;
}

export interface PickerDialogProps<A extends string> {
    /** The `?action=` literal that opens this dialog. */
    action: A;
    /**
     * Show the dialog on arrival (nothing picked yet). It stays dismissable: once dismissed it
     * only reopens through `?action=` until the user leaves the page and comes back.
     */
    forceOpen?: boolean;
    /** Trigger button icon. */
    icon: ReactNode;
    /** Trigger button label; screen-reader only below `sm`. */
    label: string;
    /** Hide the trigger button below `sm`, when the page offers it in a dropdown menu instead. */
    compact?: boolean;
    title: ReactNode;
    description: ReactNode;
    /**
     * The picker list, rendered inside `DialogBoundary` so its query only runs while the dialog
     * is open (the dialog itself is always mounted).
     */
    children: (controls: PickerDialogControls) => ReactNode;
}

/**
 * Shell for a command-style picker dialog: the trigger button, the `?action=` open state
 * (push on open, replace on close), being forced open on arrival but dismissable, and the
 * header and `DialogBoundary` around the caller's picker list.
 *
 * The caller decides what a pick does. One that stays on the page writes its params and calls
 * `close()`. One that navigates calls `dismiss()` and `router.push`es, leaving `action` alone.
 */
export function PickerDialog<A extends string>({
    action: actionValue,
    forceOpen = false,
    icon,
    label,
    compact = false,
    title,
    description,
    children,
}: PickerDialogProps<A>) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral([actionValue] as const),
    );

    // `forceOpen` (nothing picked yet) shows the dialog on arrival, but it stays dismissable:
    // Escape leaves the page with its prompt and the trigger button to reopen. Once dismissed,
    // it only ever reopens through `?action=`, so a Back-button navigation that clears the
    // param always closes it.
    const [dismissed, setDismissed] = useDismissedThisVisit();
    const open = action === actionValue || (forceOpen && !dismissed);

    function handleOpenChange(next: boolean) {
        if (!next) setDismissed(true);
        void setAction(next ? actionValue : null, { history: next ? "push" : "replace" });
    }

    const controls: PickerDialogControls = {
        dismiss: () => setDismissed(true),
        close: () => {
            setDismissed(true);
            void setAction(null, { history: "replace" });
        },
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Button
                variant="outline"
                onClick={() => handleOpenChange(true)}
                className={cn(compact && "max-sm:hidden")}
            >
                {icon}
                <span className="sr-only sm:not-sr-only">{label}</span>
            </Button>
            <DialogContent className="gap-0 p-0">
                <DialogHeader className="border-b px-4 py-3">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBoundary>{children(controls)}</DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}
