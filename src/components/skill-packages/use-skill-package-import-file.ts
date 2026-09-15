/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";

import { useFileContents } from "@/hooks/use-file-contents";
import {
    SkillPackageExport,
    type SkillPackageExport as SkillPackageExportType,
} from "@/lib/schemas/skill-package-export";

export interface UseSkillPackageImportFileResult {
    fileName: string | null;
    envelope: SkillPackageExportType | null;
    error: string | null;
    isReading: boolean;
    handleFile: (file: File) => void;
    reset: () => void;
}

/**
 * Reads a picked `.json` file and validates it against the shared `SkillPackageExport`
 * envelope schema client-side, for inline errors before a dialog's preview/import mutation
 * ever runs — the server re-validates the same schema on the actual input.
 */
export function useSkillPackageImportFile(): UseSkillPackageImportFileResult {
    const file = useFileContents();

    const parsed = useMemo(() => {
        if (file.text === null) return { envelope: null, error: null };
        try {
            const result = SkillPackageExport.schema.safeParse(JSON.parse(file.text));
            return result.success
                ? { envelope: result.data, error: null }
                : { envelope: null, error: "This file is not a valid skill-package export." };
        } catch {
            return { envelope: null, error: "This file is not valid JSON." };
        }
    }, [file.text]);

    return {
        fileName: file.fileName,
        envelope: parsed.envelope,
        error: file.error ?? parsed.error,
        isReading: file.isReading,
        handleFile: file.readFile,
        reset: file.reset,
    };
}
