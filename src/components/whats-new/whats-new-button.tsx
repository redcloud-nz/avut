/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The two ways to reopen the What's new dialog: the version string in the sidebar footer, and an
 * item in the user menu.
 */

"use client";

import { SparklesIcon } from "lucide-react";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { VersionString } from "@/components/ui/version-string";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

import { useWhatsNew, WhatsNewBoundary } from "./whats-new-dialog";

/**
 * Opens the dialog on the unseen entries if there are any, and the most recent ones otherwise.
 *
 * Reads `getUnseen` from the cache at click time rather than subscribing to it, so its callers
 * can render before the query resolves (or after it fails). Unresolved or failed reads as
 * "nothing unseen", which opens the recent entries.
 */
function useShowWhatsNew() {
    const { show } = useWhatsNew();
    const queryClient = useQueryClient();

    return () => {
        const unseen = queryClient.getQueryData(trpc.whatsNew.getUnseen.queryKey())?.entries ?? [];
        show(unseen.length > 0 ? { mode: "unseen", entries: unseen } : { mode: "recent" });
    };
}

/**
 * The sidebar footer's version string, as a button that opens the What's new dialog. It carries
 * a dot while anything is unseen.
 *
 * Renders the version whatever `getUnseen` is doing — only the dot waits on it, inside its own
 * `WhatsNewBoundary`.
 */
export function WhatsNewVersionButton({ className }: { className?: string }) {
    const showWhatsNew = useShowWhatsNew();

    return (
        <button
            type="button"
            title="What's new"
            onClick={showWhatsNew}
            className={cn(
                "relative rounded-md px-2 py-1 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-hidden",
                className,
            )}
        >
            <VersionString layout="stacked" />
            <span className="sr-only"> — What&apos;s new</span>
            <WhatsNewBoundary>
                <UnseenDot />
            </WhatsNewBoundary>
        </button>
    );
}

/** The unseen marker on `WhatsNewVersionButton`. Reads `getUnseen` with `useSuspenseQuery`. */
function UnseenDot() {
    const { data: unseen } = useSuspenseQuery(trpc.whatsNew.getUnseen.queryOptions());
    if (unseen.entries.length === 0) return null;

    return (
        <>
            <span aria-hidden className="absolute top-1 right-0 size-1.5 rounded-full bg-primary" />
            <span className="sr-only">(unseen updates)</span>
        </>
    );
}

/** "What's new" in the user menu. Mount inside a `DropdownMenuContent`. */
export function WhatsNewMenuItem() {
    const showWhatsNew = useShowWhatsNew();

    return (
        <DropdownMenuItem onSelect={showWhatsNew}>
            <SparklesIcon />
            <span>What&apos;s new</span>
        </DropdownMenuItem>
    );
}
