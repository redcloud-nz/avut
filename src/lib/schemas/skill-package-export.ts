/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { propertiesSchema, tagsSchema } from "../validation";

import { SkillId } from "./skill";
import { SkillGroupId } from "./skill-group";
import { SkillPackageId } from "./skill-package";

/**
 * Bump when the envelope shape changes in a way an older importer can't read. The importer
 * rejects any file whose `formatVersion` it does not recognise.
 */
export const SKILL_PACKAGE_EXPORT_FORMAT_VERSION = 1;

/**
 * Portable representation of a skill-package authoring tree
 * (`SkillPackage → SkillGroup → Skill`) for moving a package between AVUT instances,
 * whose databases are separate and cannot be reached by `SkillPackageSubscription`.
 *
 * Carries the authoring tree only — no checks, sessions, subscriptions, or override rows.
 * Record IDs are preserved across the round-trip so a re-import updates the same rows
 * (see `planSkillPackageImport`). `published` and `status` are deliberately absent:
 * an import always lands `published: false` / `status: Active`.
 */

const exportedSkillSchema = z.object({
    id: SkillId.schema,
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    sequence: z.number().int().nonnegative(),
    frequency: z.number().int().nonnegative(),
    defaultInclude: z.boolean(),
    defaultRequired: z.boolean(),
});

const exportedGroupSchema = z.object({
    id: SkillGroupId.schema,
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    sequence: z.number().int().nonnegative(),
    defaultInclude: z.boolean(),
    skills: z.array(exportedSkillSchema),
});

const exportedPackageSchema = z.object({
    id: SkillPackageId.schema,
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    groups: z.array(exportedGroupSchema),
});

const skillPackageExportSchema = z.object({
    formatVersion: z.literal(SKILL_PACKAGE_EXPORT_FORMAT_VERSION),
    exportedAt: z.iso.datetime(),
    package: exportedPackageSchema,
});

export const SkillPackageExport = {
    schema: skillPackageExportSchema,
    packageSchema: exportedPackageSchema,
    groupSchema: exportedGroupSchema,
    skillSchema: exportedSkillSchema,
} as const;

export type SkillPackageExport = z.infer<typeof skillPackageExportSchema>;
export type ExportedPackage = z.infer<typeof exportedPackageSchema>;
export type ExportedGroup = z.infer<typeof exportedGroupSchema>;
export type ExportedSkill = z.infer<typeof exportedSkillSchema>;
