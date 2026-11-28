/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The "What's new" dialog: one entry per release (see content/updates/README.md). Opened by the
 * `?whats-new=` search param, which its triggers (`whats-new-button.tsx`) set, and on its own
 * when there are unseen entries.
 */

"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";

import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { whatsNewEffects } from "@/client/whats-new-effects";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { updatesHref, type UpdateEntryData } from "@/lib/updates-shared";
import { trpc } from "@/trpc/client";

import { UpdateArticle } from "./update-article";

/**
 * `?whats-new=` opens the dialog:
 * - `unseen`: the entries the user hasn't seen, or the recent ones when nothing is unseen. What
 *   the triggers set.
 * - `recent`: the most recent entries, whatever has been seen.
 */
const whatsNewParser = parseAsStringLiteral(["unseen", "recent"] as const);

type WhatsNewParam = "unseen" | "recent";

/**
 * Returns a function that opens the What's new dialog, for its triggers. Pushes a history entry,
 * so Back closes the dialog again.
 */
export function useOpenWhatsNew() {
    const [, setParam] = useQueryState("whats-new", whatsNewParser);
    return () => void setParam("unseen", { history: "push" });
}

/**
 * What the dialog shows, resolved once per opening:
 * - `unseen`: the unseen entries, snapshotted when it opens so the list doesn't empty mid-close
 *   when `markSeen` clears `getUnseen`. Closing marks them seen.
 * - `recent`: the most recent entries, fetched on open. Closing marks nothing.
 */
type WhatsNewView = { mode: "unseen"; entries: UpdateEntryData[] } | { mode: "recent" };

/**
 * The What's new dialog, its auto-open, and its `markSeen`. Mount once, in the authenticated
 * layout, outside `<Sidebar>`: on mobile its offcanvas sheet unmounts its content while closed,
 * so a dialog in there could never open on its own.
 *
 * Reads `getUnseen` with plain `useQuery`, in the browser only: nothing here is needed for first
 * paint, so it is never prefetched or hydrated from the server. Loading or failing, it renders a
 * closed dialog; a failed `getUnseen` reads as "nothing unseen".
 *
 * Auto-opens once per mount, when `getUnseen` arrives with entries, unless the user has clicked or
 * pressed a key since it mounted: the query resolves a round trip after hydration, and a dialog
 * that appears mid-click steals focus. Then only the version button's dot shows them.
 *
 * Closing from `unseen` mode, however it closes (Got it, the close button, Escape, clicking
 * outside, Back), marks every entry it showed as seen. A failed `markSeen` is deliberately
 * silent: the entries simply show again on the next full load.
 */
export function WhatsNew() {
    const [param, setParam] = useQueryState("whats-new", whatsNewParser);
    const unseen = useQuery(trpc.whatsNew.getUnseen.queryOptions());

    const { mutate: markSeen } = useMutation(
        trpc.whatsNew.markSeen.mutationOptions({ meta: { effects: whatsNewEffects.markSeen } }),
    );

    // The view is kept after the dialog closes, so the content doesn't change during its exit
    // animation. `resolvedFor` is the param value it was resolved for; a new opening resolves
    // it again.
    const [view, setView] = useState<WhatsNewView>({ mode: "recent" });
    const [resolvedFor, setResolvedFor] = useState<WhatsNewParam | null>(null);
    if (param === null && resolvedFor !== null) {
        setResolvedFor(null);
    } else if (param !== null && param !== resolvedFor) {
        const next = resolveView(param, unseen.isPending, unseen.data?.entries ?? []);
        if (next) {
            setView(next);
            setResolvedFor(param);
        }
    }
    // An `unseen` opening waits for `getUnseen` before it shows anything.
    const open = param !== null && param === resolvedFor;

    // Mark seen on every close, Back included, which changes the param without going through
    // `handleOpenChange`. Entries are newest first, so the first one shown is the newest version.
    const wasOpen = useRef(false);
    useEffect(() => {
        if (wasOpen.current && !open && view.mode === "unseen" && view.entries.length > 0) {
            markSeen({ through: view.entries[0].version });
        }
        wasOpen.current = open;
    }, [open, view, markSeen]);

    const interacted = useInteractedSinceMount();
    // Once per mount of the layout, so a failed `markSeen` (which leaves `getUnseen` as it was)
    // can't reopen it on every navigation.
    const autoOpenDecided = useRef(false);
    useEffect(() => {
        if (autoOpenDecided.current || !unseen.data) return;
        autoOpenDecided.current = true;
        if (unseen.data.entries.length === 0 || interacted.current || param !== null) return;
        // Replace: opening on its own shouldn't leave a history entry behind.
        void setParam("unseen", { history: "replace" });
    }, [unseen.data, interacted, param, setParam]);

    function handleOpenChange(next: boolean) {
        if (!next) void setParam(null, { history: "replace" });
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent size="xl">
                <DialogHeader>
                    <DialogTitle>What&apos;s new</DialogTitle>
                    <DialogDescription>
                        {view.mode === "unseen"
                            ? "Here's what has changed in AVUT since you last looked."
                            : "Recent releases of AVUT."}
                    </DialogDescription>
                </DialogHeader>
                {view.mode === "unseen" ? (
                    <WhatsNew_Entries entries={view.entries} />
                ) : (
                    <DialogBoundary>
                        <WhatsNew_Recent />
                    </DialogBoundary>
                )}
            </DialogContent>
        </Dialog>
    );
}

/**
 * The view for an opening with `param`, or `undefined` while `getUnseen` is still loading.
 * `unseen` with nothing unseen (or a failed `getUnseen`) shows the recent entries.
 */
function resolveView(
    param: WhatsNewParam,
    unseenPending: boolean,
    unseenEntries: UpdateEntryData[],
): WhatsNewView | undefined {
    if (param === "recent") return { mode: "recent" };
    if (unseenPending) return undefined;
    return unseenEntries.length > 0
        ? { mode: "unseen", entries: unseenEntries }
        : { mode: "recent" };
}

/**
 * A ref that turns true at the first click or key press after mount. Listens in the capture
 * phase, so a handler that stops propagation can't hide the interaction.
 */
function useInteractedSinceMount() {
    const interacted = useRef(false);
    useEffect(() => {
        const controller = new AbortController();
        const onInteract = () => {
            interacted.current = true;
            controller.abort();
        };
        for (const type of ["pointerdown", "keydown"] as const) {
            window.addEventListener(type, onInteract, {
                capture: true,
                signal: controller.signal,
            });
        }
        return () => controller.abort();
    }, []);
    return interacted;
}

/** `recent` mode's entries, fetched when the dialog opens (Radix mounts the content only then). */
function WhatsNew_Recent() {
    const { data } = useSuspenseQuery(trpc.whatsNew.listRecent.queryOptions());
    return <WhatsNew_Entries entries={data.entries} />;
}

function WhatsNew_Entries({ entries }: { entries: UpdateEntryData[] }) {
    return (
        <>
            <DialogBody>
                {entries.length === 0 ? (
                    <p className="text-muted-foreground">No updates yet.</p>
                ) : (
                    <div className="flex flex-col divide-y">
                        {entries.map((entry) => (
                            <UpdateArticle
                                key={entry.slug}
                                entry={entry}
                                headingLevel="h3"
                                linkInNewTab
                                className="py-4 first:pt-0 last:pb-0"
                            />
                        ))}
                    </div>
                )}
            </DialogBody>
            <DialogFooter>
                {/* `/docs/updates` sits outside the app shell, so open it in a new tab (as
                    `help-sheet.tsx` does for the docs). */}
                <Button variant="outline" asChild>
                    <Link href={updatesHref()} target="_blank" rel="noopener noreferrer">
                        See all updates
                        <ArrowUpRightIcon />
                        <span className="sr-only">(opens in a new tab)</span>
                    </Link>
                </Button>
                <DialogClose asChild>
                    <Button>Got it</Button>
                </DialogClose>
            </DialogFooter>
        </>
    );
}
