/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";
import { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { Hermes } from "@/components/blocks/hermes";
import { Saratoga } from "@/components/blocks/saratoga";
import { describeError, ErrorDescriptions } from "@/components/errors/describe-error";

import { useIsDeletedNote } from "./deleted-notes";
import { notesBreadcrumbs } from "./notes-breadcrumbs";

/** Whether a query error means the note doesn't exist (any more). */
export function isNoteNotFound(error: unknown) {
    return describeError(error) === ErrorDescriptions.NotFound;
}

interface NoteGoneBoundaryProps {
    /** The note's scope: an organization or user id, as passed to `rememberDeletedNote`. */
    scopeId: string;
    noteId: string;
    /**
     * The notes list, for the "Notes" crumb above the placeholder: the way back at phone width,
     * where the list pane is hidden.
     */
    listHref: Route;
    /** The pane's content, which reads the note's `getNote`. */
    children: ReactNode;
}

/**
 * Wraps a detail-pane page for one note (the note itself, or its History), so a note that's gone
 * says so in the pane rather than falling through to the route's error page. That covers a note
 * deleted here and reached again with Back (checked before `children` read `getNote` at all, see
 * `deleted-notes.ts`), and one deleted by someone else (`getNote` comes back `NOT_FOUND`). Other
 * errors still propagate. The placeholder keeps the "Notes" crumb, as on a note.
 */
export function NoteGoneBoundary({ scopeId, noteId, listHref, children }: NoteGoneBoundaryProps) {
    const deleted = useIsDeletedNote(scopeId, noteId);

    const deletedMessage = (
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-2">
            <Saratoga.Breadcrumbs items={notesBreadcrumbs(listHref)} />
            <Hermes.Placeholder className="flex h-auto flex-1">
                This note was deleted.
            </Hermes.Placeholder>
        </div>
    );

    if (deleted) return deletedMessage;

    return (
        <ErrorBoundary
            resetKeys={[noteId]}
            fallbackRender={({ error }) => {
                if (!isNoteNotFound(error)) throw error;
                return deletedMessage;
            }}
        >
            {children}
        </ErrorBoundary>
    );
}
