/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCError } from "@trpc/server";

import {
    SkillPackageExport,
    type SkillPackageExport as SkillPackageExportType,
} from "@/lib/schemas/skill-package-export";

import exampleStarterPackage from "./example-starter-package.json";

/**
 * Bundled skill-package library.
 *
 * v1 has no in-app file upload, so importable packages ship as `.json` files in the repo and
 * are imported from the system-admin module. Add a file to this directory and register it in
 * `RAW_LIBRARY` below (a static import, so the bundler traces it). Each file must match the
 * shared `SkillPackageExport` envelope — produce one with `skillPackageBuilder.exportPackage`.
 */
const RAW_LIBRARY: Record<string, unknown> = {
    "example-starter-package.json": exampleStarterPackage,
};

export interface SkillPackageLibraryEntry {
    fileName: string;
    packageId: string;
    name: string;
    description: string;
    tags: string[];
    groupCount: number;
    skillCount: number;
    envelope: SkillPackageExportType;
}

function toEntry(fileName: string, raw: unknown): SkillPackageLibraryEntry {
    const envelope = SkillPackageExport.schema.parse(raw);
    return {
        fileName,
        packageId: envelope.package.id,
        name: envelope.package.name,
        description: envelope.package.description,
        tags: envelope.package.tags,
        groupCount: envelope.package.groups.length,
        skillCount: envelope.package.groups.reduce((n, g) => n + g.skills.length, 0),
        envelope,
    };
}

/** All bundled library packages, validated. Throws at call time if a bundled file is malformed. */
export function listSkillPackageLibrary(): SkillPackageLibraryEntry[] {
    return Object.entries(RAW_LIBRARY)
        .map(([fileName, raw]) => toEntry(fileName, raw))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** @throws TRPCError(NOT_FOUND) if no bundled file has that name. */
export function getSkillPackageLibraryEntry(fileName: string): SkillPackageLibraryEntry {
    const raw = RAW_LIBRARY[fileName];
    if (raw === undefined) {
        throw new TRPCError({
            code: "NOT_FOUND",
            message: `No bundled skill package file named ${fileName}.`,
        });
    }
    return toEntry(fileName, raw);
}
