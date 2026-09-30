/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { SparklesIcon } from "lucide-react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";

import { useWhatsNew } from "./whats-new-dialog";

/**
 * Reopens the What's new dialog from the sidebar footer, with a dot while anything is unseen. It
 * opens the unseen entries while there are some, and the most recent ones otherwise.
 *
 * Reads `getUnseen` with `useSuspenseQuery`, so mount it inside its own `<Suspense fallback={null}>`.
 */
export function WhatsNewButton() {
    const { show } = useWhatsNew();
    const { data: unseen } = useSuspenseQuery(trpc.whatsNew.getUnseen.queryOptions());

    const hasUnseen = unseen.entries.length > 0;

    return (
        <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() =>
                show(hasUnseen ? { mode: "unseen", entries: unseen.entries } : { mode: "recent" })
            }
        >
            <SparklesIcon />
            What&apos;s new
            {hasUnseen && (
                <>
                    <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                    <span className="sr-only">(unseen updates)</span>
                </>
            )}
        </Button>
    );
}
