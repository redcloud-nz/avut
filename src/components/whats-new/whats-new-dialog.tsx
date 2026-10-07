/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The "What's new" dialog, its auto-open, and the context its triggers (the
 * sidebar footer's version button, the user menu item) open it through. One entry per release; see content/updates/README.md.
 */

"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import {
    createContext,
    ReactNode,
    Suspense,
    use,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

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
 * What the dialog shows:
 * - `unseen`: the entries the user hasn't seen, snapshotted when the dialog opens so the list
 *   doesn't empty mid-close when `markSeen` clears `getUnseen`. Closing marks them seen.
 * - `recent`: the most recent entries, fetched on open. Closing marks nothing.
 */
export type WhatsNewView = { mode: "unseen"; entries: UpdateEntryData[] } | { mode: "recent" };

interface WhatsNewContextValue {
    open: boolean;
    view: WhatsNewView;
    show: (view: WhatsNewView) => void;
    setOpen: (open: boolean) => void;
}

const WhatsNewContext = createContext<WhatsNewContextValue | null>(null);

/**
 * Holds the dialog's open state and view, shared by `WhatsNewDialog` and the triggers in
 * `whats-new-button.tsx`. They mount apart (the triggers in the sidebar footer and user menu, the
 * dialog outside `<Sidebar>`, whose mobile sheet unmounts its content while closed), so the state
 * lives above them all.
 *
 * Local state rather than a `?action=` param: this isn't a mutation dialog, and opening it
 * automatically on load shouldn't push a history entry.
 */
export function WhatsNewProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<WhatsNewView>({ mode: "recent" });

    const value = useMemo<WhatsNewContextValue>(
        () => ({
            open,
            view,
            show(next) {
                setView(next);
                setOpen(true);
            },
            setOpen,
        }),
        [open, view],
    );

    return <WhatsNewContext value={value}>{children}</WhatsNewContext>;
}

export function useWhatsNew(): WhatsNewContextValue {
    const context = use(WhatsNewContext);
    if (!context) throw new Error("useWhatsNew must be used within a WhatsNewProvider");
    return context;
}

/**
 * Wraps a What's new consumer (`WhatsNewDialog`, the version button's unseen dot) so it renders nothing while
 * `getUnseen` loads, and nothing if it fails. The popup is optional: without the error boundary a
 * failed prefetch would bubble past the layout to `src/app/error.tsx` and take down every
 * authenticated page.
 */
export function WhatsNewBoundary({ children }: { children: ReactNode }) {
    return (
        <ErrorBoundary
            onError={(error) => console.error("What's new failed to load:", error)}
            fallback={null}
        >
            <Suspense fallback={null}>{children}</Suspense>
        </ErrorBoundary>
    );
}

/**
 * The dialog itself. Opens once, on its own, when `whatsNew.getUnseen` has entries; closing it
 * from `unseen` mode (Got it, the close button, Escape or clicking outside) marks every entry it
 * showed as seen.
 *
 * A failed `markSeen` is deliberately silent: the auto-open ref stops the dialog reopening for the
 * rest of this session, and the entries simply show again on the next full load.
 *
 * Reads `getUnseen` with `useSuspenseQuery`, so mount it inside a `WhatsNewBoundary`.
 */
export function WhatsNewDialog() {
    const { open, view, show, setOpen } = useWhatsNew();

    const { data: unseen } = useSuspenseQuery(trpc.whatsNew.getUnseen.queryOptions());

    const markSeen = useMutation(
        trpc.whatsNew.markSeen.mutationOptions({ meta: { effects: whatsNewEffects.markSeen } }),
    );

    // Once per mount of the layout, so a failed `markSeen` (which leaves `getUnseen` as it was)
    // can't reopen it on every navigation.
    const autoOpened = useRef(false);
    useEffect(() => {
        if (autoOpened.current || unseen.entries.length === 0) return;
        autoOpened.current = true;
        show({ mode: "unseen", entries: unseen.entries });
    }, [unseen.entries, show]);

    function handleOpenChange(next: boolean) {
        setOpen(next);
        // Entries are newest first, so the first one shown is the newest version.
        if (!next && view.mode === "unseen" && view.entries.length > 0) {
            markSeen.mutate({ through: view.entries[0].version });
        }
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
                    <WhatsNewDialog_Entries entries={view.entries} />
                ) : (
                    <DialogBoundary>
                        <WhatsNewDialog_Recent />
                    </DialogBoundary>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** `recent` mode's entries, fetched when the dialog opens (Radix mounts the content only then). */
function WhatsNewDialog_Recent() {
    const { data } = useSuspenseQuery(trpc.whatsNew.listRecent.queryOptions());
    return <WhatsNewDialog_Entries entries={data.entries} />;
}

function WhatsNewDialog_Entries({ entries }: { entries: UpdateEntryData[] }) {
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
