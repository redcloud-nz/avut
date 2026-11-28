/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";
import { ReactNode } from "react";

import type { SaratogaBreadcrumb } from "@/components/blocks/saratoga";
import { RenderMarkdown } from "@/components/markdown/render";
import { cn } from "@/lib/utils";

import { NoteCard, noteTitleClassName } from "./note-card";

interface NoteDetailProps {
    note: { title: string; content: string; updatedAt: string };
    /** Shown after the updated time, e.g. the author of an org note. Omit for personal notes. */
    byline?: ReactNode;
    /** The note's History page; the "updated" time links to it. */
    historyHref: Route;
    /** The controls the caller is allowed to show: the pencil and the ⋮. */
    actions?: ReactNode;
    /** The page's ancestors, shown above the note. */
    breadcrumbs?: SaratogaBreadcrumb[];
}

/** A note in view mode: its title, when it was last updated, and its rendered markdown. */
export function NoteDetail({ note, byline, historyHref, actions, breadcrumbs }: NoteDetailProps) {
    return (
        <NoteCard
            note={note}
            byline={byline}
            historyHref={historyHref}
            actions={actions}
            breadcrumbs={breadcrumbs}
            title={<h1 className={cn(noteTitleClassName, "border-transparent")}>{note.title}</h1>}
        >
            {note.content.trim() === "" ? (
                <p className="markdown-content text-muted-foreground">This note is empty.</p>
            ) : (
                <RenderMarkdown markdown={note.content} />
            )}
        </NoteCard>
    );
}
