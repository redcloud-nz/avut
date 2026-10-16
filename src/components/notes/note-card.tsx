/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ComponentProps, ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { usePreferences } from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";

/**
 * The typography a note's title shares between view mode (a heading) and edit mode (an input),
 * so toggling edit doesn't move it. The transparent bottom border in view mode matches the input's
 * visible one.
 */
export const noteTitleClassName =
    "block h-8 w-full min-w-0 truncate border-b bg-transparent p-0 text-xl leading-8 font-semibold tracking-tight";

interface NoteCardProps extends Omit<ComponentProps<"div">, "title"> {
    note: { updatedAt: string };
    /** The heading in view mode, the title input in edit mode. */
    title: ReactNode;
    /** Shown after the updated time, e.g. the author of an org note. Omit for personal notes. */
    byline?: ReactNode;
    /** Top-right controls: Edit/menu in view mode, Cancel/Save in edit mode. */
    actions?: ReactNode;
    /** The rendered markdown in view mode, the editor in edit mode. */
    children: ReactNode;
}

/**
 * The card a note sits in, in both view and edit mode. Both modes fill it the same way (title and
 * byline, then the body), so clicking Edit only makes the note editable: nothing moves. The card
 * is at least as tall as the pane, so its size doesn't change either.
 */
export function NoteCard({
    note,
    title,
    byline,
    actions,
    children,
    className,
    ...props
}: NoteCardProps) {
    const { formatRelativeDateTime } = usePreferences();

    return (
        <Card
            className={cn("mx-auto min-h-full w-full max-w-5xl gap-0 py-0", className)}
            {...props}
        >
            <div className="flex items-start gap-2 px-4 pt-4">
                <div className="min-w-0 flex-1">
                    {title}
                    <p className="mt-1 text-xs text-muted-foreground">
                        updated {formatRelativeDateTime(note.updatedAt)}
                        {byline && <> · {byline}</>}
                    </p>
                </div>
                {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">{children}</div>
        </Card>
    );
}
