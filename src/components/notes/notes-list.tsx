/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { PlusIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { usePreferences } from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";

/** A note as the list pane shows it. `author` is omitted for personal notes. */
export interface NotesListItem {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    author?: { id: string; name: string } | null;
}

const SORT_OPTIONS = {
    updated: "Last updated",
    created: "Created",
    title: "Title",
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

function compareNotes(sort: SortKey) {
    return (a: NotesListItem, b: NotesListItem): number => {
        switch (sort) {
            case "updated":
                return b.updatedAt.localeCompare(a.updatedAt);
            case "created":
                return b.createdAt.localeCompare(a.createdAt);
            case "title":
                return a.title.localeCompare(b.title, undefined, {
                    numeric: true,
                    sensitivity: "base",
                });
        }
    };
}

interface NotesListProps {
    notes: NotesListItem[];
    /** The id of the note open in the detail pane, if any. */
    selectedId: string | null;
    /** The detail route for a note. */
    hrefFor: (noteId: string) => Route;
    /** Creates a note and opens it. Omit to hide the New note button. */
    onCreate?: () => void;
    /** Whether a create is in flight. */
    creating?: boolean;
}

/**
 * The list pane of a notes module: a header with the sort and New note controls, then one row per
 * note. Sorting is local state, so it survives record navigation while the list stays mounted in
 * the route's layout.
 */
export function NotesList({
    notes,
    selectedId,
    hrefFor,
    onCreate,
    creating = false,
}: NotesListProps) {
    const { formatRelativeDateTime } = usePreferences();
    const [sort, setSort] = useState<SortKey>("updated");

    const sorted = useMemo(() => notes.toSorted(compareNotes(sort)), [notes, sort]);

    return (
        <div className="flex flex-col">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background p-2">
                <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
                    <SelectTrigger size="sm" aria-label="Sort notes" className="flex-1">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(SORT_OPTIONS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {onCreate && (
                    <Button size="sm" onClick={onCreate} disabled={creating}>
                        {creating ? <Spinner /> : <PlusIcon />}
                        New note
                    </Button>
                )}
            </div>

            {sorted.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No notes yet.</p>
            ) : (
                <ul>
                    {sorted.map((note) => (
                        <li key={note.id}>
                            <Link
                                href={hrefFor(note.id)}
                                prefetch={true}
                                aria-current={note.id === selectedId ? "page" : undefined}
                                className={cn(
                                    "flex flex-col gap-0.5 border-b px-4 py-3 hover:bg-muted/50",
                                    "aria-[current=page]:bg-muted",
                                )}
                            >
                                <span className="truncate font-medium">{note.title}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    updated {formatRelativeDateTime(note.updatedAt)}
                                    {note.author !== undefined && (
                                        <> · {note.author?.name ?? "Unknown author"}</>
                                    )}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
