/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useCallback, useState } from "react";

const DEFAULT_MAX_SIZE_BYTES = 1_000_000;

export interface UseFileContentsOptions {
    /** Reject files larger than this before reading. Default 1 MB. */
    maxSizeBytes?: number;
}

export interface FileContentsState {
    fileName: string | null;
    text: string | null;
    error: string | null;
    isReading: boolean;
}

export interface UseFileContentsResult extends FileContentsState {
    readFile: (file: File) => void;
    reset: () => void;
}

/**
 * Reads a picked file's text content in the browser, no server round-trip. Pairs with a
 * `Zod.safeParse` at the call site for inline validation before the parsed object is sent as
 * an ordinary tRPC mutation input — see `docs/ideas/2026-09-10-generic-file-upload.md`.
 */
export function useFileContents(options: UseFileContentsOptions = {}): UseFileContentsResult {
    const maxSizeBytes = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
    const [state, setState] = useState<FileContentsState>({
        fileName: null,
        text: null,
        error: null,
        isReading: false,
    });

    const reset = useCallback(() => {
        setState({ fileName: null, text: null, error: null, isReading: false });
    }, []);

    const readFile = useCallback(
        (file: File) => {
            if (file.size > maxSizeBytes) {
                setState({
                    fileName: file.name,
                    text: null,
                    error: `"${file.name}" is too large (max ${Math.round(maxSizeBytes / 1000)} KB).`,
                    isReading: false,
                });
                return;
            }

            setState({ fileName: file.name, text: null, error: null, isReading: true });

            const reader = new FileReader();
            reader.onload = () => {
                setState({
                    fileName: file.name,
                    text: typeof reader.result === "string" ? reader.result : null,
                    error: null,
                    isReading: false,
                });
            };
            reader.onerror = () => {
                setState({
                    fileName: file.name,
                    text: null,
                    error: "Could not read the file.",
                    isReading: false,
                });
            };
            reader.readAsText(file);
        },
        [maxSizeBytes],
    );

    return { ...state, readFile, reset };
}
