/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { ModuleId } from "@/lib/modules";

/**
 * Which log a `LogEntry` belongs to.
 *
 * Partly derivable from the entry's foreign keys, but kept explicit so the
 * owner invariant can be guarded on write and the per-scope feeds can be
 * indexed. Intended to match a realigned `modules.ts` `ModuleScope`.
 */
const logScopeValues = ["organization", "user", "system"] as const;

export const LogScope = {
    values: logScopeValues,
    schema: z.enum(logScopeValues),
} as const;

export type LogScope = (typeof logScopeValues)[number];

/** What happened. */
const logActionValues = [
    "Approve",
    "Archive",
    "Ban",
    "Create",
    "Delete",
    "Impersonate",
    "Move",
    "Publish",
    "Restore",
    "Subscribe",
    "Unban",
    "Unpublish",
    "Unsubscribe",
    "Update",
] as const;

export const LogAction = {
    values: logActionValues,
    schema: z.enum(logActionValues),
} as const;

export type LogAction = (typeof logActionValues)[number];

/** What it happened to. */
const logObjectTypeValues = [
    "Account",
    "D4hAccessToken",
    "I3Template",
    "I3TemplateVariant",
    "Organization",
    "OrganizationMembership",
    "OrganizationSettings",
    "Person",
    "Session",
    "Skill",
    "SkillCheckSession",
    "SkillGroup",
    "SkillPackage",
    "Team",
    "TeamMembership",
    "User",
] as const;

export const LogObjectType = {
    values: logObjectTypeValues,
    schema: z.enum(logObjectTypeValues),
} as const;

export type LogObjectType = (typeof logObjectTypeValues)[number];

/**
 * How a `LogEntryObject` relates to its entry.
 *
 * Stored as text so adding a value never needs a migration, but typed as a
 * closed union — `recordLogEntry` rejects anything off it. Disambiguation
 * relies on `objectType`, so `"from"` needs no compound tokens: `role: "from"`
 * with `objectType: "SkillPackage"` is unambiguous against the same role with
 * `objectType: "SkillGroup"`.
 */
const logRefRoleValues = ["primary", "context", "from", "to"] as const;

export const LogRefRole = {
    values: logRefRoleValues,
    schema: z.enum(logRefRoleValues),
} as const;

export type LogRefRole = (typeof logRefRoleValues)[number];

/**
 * Module attribution, derived rather than stored.
 *
 * A module is a pure function of `objectType`, so a `moduleId` column would be
 * a derived value maintained at ~60 call sites. Deriving means a fix to this
 * map rewrites history — the behaviour we want while the map is young and
 * possibly wrong, and the wrong one once module boundaries are settled. Revisit
 * when a display exists.
 *
 * `Skill`/`SkillGroup`/`SkillPackage` are the one genuine ambiguity: they are
 * authored in `skill-package-builder` and consumed in `skill-track`. They are
 * attributed to where they are mutated, which is where entries originate.
 */
const moduleByObjectType: Record<LogObjectType, ModuleId | null> = {
    Account: null,
    D4hAccessToken: "admin",
    I3Template: "i3",
    I3TemplateVariant: "i3",
    Organization: "admin",
    OrganizationMembership: "admin",
    OrganizationSettings: "admin",
    Person: "admin",
    Session: null,
    Skill: "skill-package-builder",
    SkillCheckSession: "skill-track",
    SkillGroup: "skill-package-builder",
    SkillPackage: "skill-package-builder",
    Team: "admin",
    TeamMembership: "admin",
    User: null,
};

/** The module an entry about this kind of object belongs to, or null for account entities. */
export function moduleIdForObjectType(objectType: LogObjectType): ModuleId | null {
    return moduleByObjectType[objectType];
}

/** The object types whose entries make up a module's activity feed. */
export function objectTypesForModule(moduleId: ModuleId): LogObjectType[] {
    return LogObjectType.values.filter((objectType) => moduleByObjectType[objectType] === moduleId);
}
