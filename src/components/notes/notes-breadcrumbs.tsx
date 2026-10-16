/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";
import { useSelectedLayoutSegments } from "next/navigation";
import { ReactNode, useState } from "react";

import { Std } from "@/components/blocks/std";

interface NotesBreadcrumbsProps {
    /** The notes already loaded for the list pane; the selected one's title names the crumb. */
    notes: { id: string; title: string }[];
    /** The notes index route. */
    listHref: Route;
    /** A note's detail route; the title crumb links there from the note's History. */
    noteHref: (noteId: string) => Route;
    actions?: ReactNode;
}

/**
 * The navbar above a notes module's master-detail layout. Must be rendered from the notes
 * `layout.tsx`, so `useSelectedLayoutSegments()` starts with the selected note's id (and is empty
 * on the index route). With a note selected the "Notes" crumb links back to the list, which is the
 * way back at phone width, where the list pane is hidden. On a note's History, the note's title
 * links back to the note.
 */
export function NotesBreadcrumbs({ notes, listHref, noteHref, actions }: NotesBreadcrumbsProps) {
    const [selectedId = null, subpage] = useSelectedLayoutSegments();
    const selected = selectedId === null ? undefined : notes.find((note) => note.id === selectedId);

    // Deleting a note drops it from the list before the navigation away lands, so hold on to the
    // last title seen for the selected note rather than falling back to "Note" for a frame.
    const [lastSeen, setLastSeen] = useState<{ id: string; title: string } | null>(null);
    if (selected && (lastSeen?.id !== selected.id || lastSeen.title !== selected.title)) {
        setLastSeen({ id: selected.id, title: selected.title });
    }
    const title = selected?.title ?? (lastSeen?.id === selectedId ? lastSeen.title : "Note");

    return (
        <Std.Navbar
            breadcrumbs={
                selectedId === null
                    ? ["Notes"]
                    : subpage === "history"
                      ? [
                            { label: "Notes", href: listHref },
                            { label: title, href: noteHref(selectedId) },
                            "History",
                        ]
                      : [{ label: "Notes", href: listHref }, title]
            }
            actions={actions}
        />
    );
}
