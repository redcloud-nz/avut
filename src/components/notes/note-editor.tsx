/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { MarkdownEditor } from "@/components/markdown/editor";
import { Button, MutationButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NoteTitle } from "@/lib/schemas/note-fields";

export interface NoteEditorValues {
    title: string;
    content: string;
}

interface NoteEditorProps {
    /** The note as saved; the editor starts from it. */
    note: NoteEditorValues;
    /** Called with the fields that changed; not called when nothing did. */
    onSave: (changes: Partial<NoteEditorValues>) => void;
    onCancel: () => void;
    /** The status of the save mutation. */
    status: "error" | "pending" | "success" | "idle";
}

/**
 * A note in edit mode: a title input above the markdown editor, with Save and Cancel. Saving is
 * explicit (no autosave). The editor holds its own draft, so remount it (e.g. with a `key`) to
 * start over from a different note.
 */
export function NoteEditor({ note, onSave, onCancel, status }: NoteEditorProps) {
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
        <Saratoga.Root className="h-full">
            <form onSubmit={handleSubmit} className="flex h-full flex-col gap-2">
                <Saratoga.Header className="items-start">
                    <div className="min-w-0 flex-1">
                        <Input
                            aria-label="Title"
                            aria-invalid={titleError !== null}
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            maxLength={200}
                            ref={titleRef}
                            autoFocus
                            className="text-base font-semibold md:text-base"
                        />
                        {titleError && (
                            <p className="mt-1 text-xs text-destructive">{titleError}</p>
                        )}
                    </div>
                    <Saratoga.Actions>
                        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                            Cancel
                        </Button>
                        <MutationButton
                            type="submit"
                            size="sm"
                            status={status}
                            text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                        />
                    </Saratoga.Actions>
                </Saratoga.Header>

                <MarkdownEditor
                    markdown={note.content}
                    onChange={setContent}
                    fill
                    className="min-h-0 flex-1 rounded-lg border"
                />
            </form>
        </Saratoga.Root>
    );
}
