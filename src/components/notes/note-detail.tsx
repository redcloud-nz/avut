/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ReactNode } from "react";

import { RenderMarkdown } from "@/components/markdown/render";
import { cn } from "@/lib/utils";

import { NoteCard, noteTitleClassName } from "./note-card";

interface NoteDetailProps {
    note: { title: string; content: string; updatedAt: string };
    /** Shown after the updated time, e.g. the author of an org note. Omit for personal notes. */
    byline?: ReactNode;
    /** The controls the caller is allowed to show: the Edit button and the actions menu. */
    actions?: ReactNode;
}

/** A note in view mode: its title, when it was last updated, and its rendered markdown. */
export function NoteDetail({ note, byline, actions }: NoteDetailProps) {
    return (
        <NoteCard
            note={note}
            byline={byline}
            actions={actions}
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
