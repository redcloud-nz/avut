/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ReactNode } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { RenderMarkdown } from "@/components/markdown/render";
import { usePreferences } from "@/hooks/use-preferences";

interface NoteDetailProps {
    note: { title: string; content: string; updatedAt: string };
    /** Shown after the updated time, e.g. the author of an org note. Omit for personal notes. */
    byline?: ReactNode;
    /** The Edit/Delete controls the caller is allowed to show. */
    actions?: ReactNode;
}

/** A note in view mode: its title, when it was last updated, and its rendered markdown. */
export function NoteDetail({ note, byline, actions }: NoteDetailProps) {
    const { formatRelativeDateTime } = usePreferences();

    return (
        <Saratoga.Root>
            <Saratoga.Header className="items-start">
                <div className="min-w-0">
                    <Saratoga.Title>{note.title}</Saratoga.Title>
                    <p className="text-xs text-muted-foreground">
                        updated {formatRelativeDateTime(note.updatedAt)}
                        {byline && <> · {byline}</>}
                    </p>
                </div>
                {actions && <Saratoga.Actions>{actions}</Saratoga.Actions>}
            </Saratoga.Header>

            {note.content.trim() === "" ? (
                <p className="py-4 text-sm text-muted-foreground">This note is empty.</p>
            ) : (
                <RenderMarkdown markdown={note.content} className="px-0! py-2!" />
            )}
        </Saratoga.Root>
    );
}
