/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import {
    type ChangeEvent,
    type DragEvent,
    type KeyboardEvent,
    type ReactNode,
    useRef,
    useState,
} from "react";
import { UploadIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
    id?: string;
    accept?: string;
    disabled?: boolean;
    "aria-invalid"?: boolean;
    /** Short helper line under the prompt, e.g. "Up to 1 MB · .json". */
    hint?: ReactNode;
    className?: string;
    onFileSelected: (file: File) => void;
}

/**
 * A drag-and-drop file picker: dashed dropzone, click-to-browse, and native drag/drop, backed by
 * a visually hidden `<input type="file">` so it still works with a `FieldLabel htmlFor`. Reports
 * one `File` at a time via `onFileSelected` — reading/validating its contents is the caller's job
 * (see `useFileContents`).
 */
export function FileDropzone({
    id,
    accept,
    disabled,
    hint,
    className,
    onFileSelected,
    ...props
}: FileDropzoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const invalid = props["aria-invalid"];

    function openPicker() {
        if (!disabled) inputRef.current?.click();
    }

    function handleFiles(fileList: FileList | null) {
        const file = fileList?.[0];
        if (file) onFileSelected(file);
    }

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-invalid={invalid}
            data-invalid={invalid}
            data-slot="file-dropzone"
            onClick={openPicker}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openPicker();
                }
            }}
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                if (!disabled) setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setIsDragOver(false);
                if (!disabled) handleFiles(event.dataTransfer.files);
            }}
            className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-6 py-8 text-center outline-none transition-colors",
                "hover:border-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                isDragOver && "border-ring bg-accent/50",
                invalid && "border-destructive/60",
                disabled && "pointer-events-none cursor-not-allowed opacity-50",
                className,
            )}
        >
            <span className="flex size-10 items-center justify-center rounded-full border border-input text-muted-foreground">
                <UploadIcon className="size-4" />
            </span>
            <span className="text-sm">
                Drag and drop, or{" "}
                <span className="font-medium underline underline-offset-2">click to browse</span>
            </span>
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
            <input
                ref={inputRef}
                id={id}
                type="file"
                accept={accept}
                disabled={disabled}
                aria-invalid={invalid}
                tabIndex={-1}
                className="sr-only"
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    handleFiles(event.target.files);
                    event.target.value = ""; // allow re-selecting the same file
                }}
            />
        </div>
    );
}
