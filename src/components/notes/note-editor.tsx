/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";

import { MarkdownEditor } from "@/components/markdown/editor";
import { Button, MutationButton } from "@/components/ui/button";
import { NoteTitle } from "@/lib/schemas/note-fields";
import { cn } from "@/lib/utils";

import { NoteCard, noteTitleClassName } from "./note-card";

export interface NoteEditorValues {
    title: string;
    content: string;
}

interface NoteEditorProps {
    /** The note as saved; the editor starts from it. */
    note: NoteEditorValues & { updatedAt: string };
    /** Shown after the updated time, as in view mode. */
    byline?: ReactNode;
    /** Called with the fields that changed; not called when nothing did. */
    onSave: (changes: Partial<NoteEditorValues>) => void;
    onCancel: () => void;
    /** The status of the save mutation. */
    status: "error" | "pending" | "success" | "idle";
}

/**
 * A note in edit mode: the same card as view mode, with the title and body made editable in
 * place and Cancel/Save where the Edit controls were. Saving is explicit (no autosave). The editor
 * holds its own draft, so remount it (e.g. with a `key`) to start over from a different note.
 */
export function NoteEditor({ note, byline, onSave, onCancel, status }: NoteEditorProps) {
    const [title, setTitle] = useState(note.title);
    const [content, setContent] = useState(note.content);
    const [titleError, setTitleError] = useState<string | null>(null);

    // Opening the editor puts you in the title with it selected, so a new note's "Untitled note"
    // is typed over rather than appended to.
    const titleRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        titleRef.current?.select();
    }, []);

    function handleSubmit(event: FormEvent) {
        event.preventDefault();

        const parsed = NoteTitle.schema.safeParse(title);
        if (!parsed.success) {
            setTitleError(parsed.error.issues[0]?.message ?? "Invalid title");
            return;
        }
        setTitleError(null);

        const changes: Partial<NoteEditorValues> = {};
        if (parsed.data !== note.title) changes.title = parsed.data;
        if (content !== note.content) changes.content = content;

        if (Object.keys(changes).length === 0) onCancel();
        else onSave(changes);
    }

    return (
        <form onSubmit={handleSubmit} className="h-full">
            <NoteCard
                note={note}
                byline={
                    titleError ? <span className="text-destructive">{titleError}</span> : byline
                }
                className="h-full"
                title={
                    <input
                        aria-label="Title"
                        aria-invalid={titleError !== null}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={200}
                        ref={titleRef}
                        autoFocus
                        className={cn(
                            noteTitleClassName,
                            "border-dashed border-input outline-none focus:border-ring aria-invalid:border-destructive",
                        )}
                    />
                }
                actions={
                    <>
                        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                            Cancel
                        </Button>
                        <MutationButton
                            type="submit"
                            size="sm"
                            status={status}
                            text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                        />
                    </>
                }
            >
                <MarkdownEditor
                    markdown={note.content}
                    onChange={(markdown, initialMarkdownNormalize) => {
                        // The editor reports its own normalised copy of the stored body once on
                        // load. That isn't an edit, and treating it as one would save and log a
                        // spurious "content changed".
                        if (!initialMarkdownNormalize) setContent(markdown);
                    }}
                    fill
                    className="min-h-0 flex-1"
                />
            </NoteCard>
        </form>
    );
}
