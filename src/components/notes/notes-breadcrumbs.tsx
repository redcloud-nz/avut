/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";
import { useSelectedLayoutSegment } from "next/navigation";
import { ReactNode } from "react";

import { Std } from "@/components/blocks/std";

interface NotesBreadcrumbsProps {
    /** The notes already loaded for the list pane; the selected one's title names the crumb. */
    notes: { id: string; title: string }[];
    /** The notes index route. */
    listHref: Route;
    actions?: ReactNode;
}

/**
 * The navbar above a notes module's master-detail layout. Must be rendered from the notes
 * `layout.tsx`, so `useSelectedLayoutSegment()` returns the selected note's id (or `null` on the
 * index route). With a note selected the "Notes" crumb links back to the list, which is the way
 * back at phone width, where the list pane is hidden.
 */
export function NotesBreadcrumbs({ notes, listHref, actions }: NotesBreadcrumbsProps) {
    const selectedId = useSelectedLayoutSegment();
    const selected = selectedId === null ? undefined : notes.find((note) => note.id === selectedId);

    return (
        <Std.Navbar
            breadcrumbs={
                selectedId === null
                    ? ["Notes"]
                    : [{ label: "Notes", href: listHref }, selected?.title ?? "Note"]
            }
            actions={actions}
        />
    );
}
