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
 * indexed.
 *
 * Intended to match a realigned `modules.ts` `ModuleScope`, which it does NOT
 * today: `ModuleScope` is `"organization" | "global"` and has no `user` member,
 * where this is `"organization" | "user" | "system"`. So `"system"` and
 * `"global"` name the same idea in two vocabularies. Do not map one onto the
 * other until they are actually realigned.
 */
const logScopeValues = ["organization", "user", "system"] as const;

export const LogScope = {
    values: logScopeValues,
    schema: z.enum(logScopeValues),
} as const;

export type LogScope = (typeof logScopeValues)[number];

/**
 * What happened.
 *
 * Declared centrally and closed, so no call site can invent a value. Entries
 * marked DORMANT reach no database today. `Ban`/`Unban`/`Impersonate` are
 * constructed only in `server/auth-log-hooks.ts`, whose better-auth
 * `databaseHooks` wire was written and then reverted, so nothing calls it.
 * `Move` has no producer at all — `skill-package-builder-router`'s `moveSkill`
 * still logs `Update`. They are kept because the vocabulary is the design, not
 * a census of the current call sites — but a reader should be able to tell
 * which half is live.
 */
const logActionValues = [
    "Approve",
    "Archive",
    "Ban", // DORMANT — reverted databaseHooks wire
    "Create",
    "Delete",
    "Impersonate", // DORMANT — reverted databaseHooks wire
    "Move", // DORMANT — moveSkill logs "Update"
    "Publish",
    "Restore",
    "Subscribe",
    "Unban", // DORMANT — reverted databaseHooks wire
    "Unpublish",
    "Unsubscribe",
    "Update",
] as const;

export const LogAction = {
    values: logActionValues,
    schema: z.enum(logActionValues),
} as const;

export type LogAction = (typeof logActionValues)[number];

/**
 * What it happened to.
 *
 * `Account` and `Session` are DORMANT for the same reason as the dormant
 * actions above: they appear only in `server/auth-log-hooks.ts`, which has no
 * callers. Every other value is written by at least one live call site.
 */
const logObjectTypeValues = [
    "Account", // DORMANT — reverted databaseHooks wire
    "D4HAccessToken",
    "I3Template",
    "I3TemplateVariant",
    "Organization",
    "OrganizationMembership",
    "OrganizationSettings",
    "Person",
    "Session", // DORMANT — reverted databaseHooks wire
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
 *
 * `from` and `to` are DORMANT: every live call site passes `context`, or
 * nothing at all (`recordLogEntry` writes the `primary` row itself). They are
 * the intended shape for a move/transfer entry, which nothing emits yet.
 */
const logRefRoleValues = ["primary", "context", "from", "to"] as const;

export const LogRefRole = {
    values: logRefRoleValues,
    schema: z.enum(logRefRoleValues),
} as const;

export type LogRefRole = (typeof logRefRoleValues)[number];

/**
 * The subset of `LogRefRole` a caller may ask for on a ref.
 *
 * `primary` is excluded deliberately. `recordLogEntry` writes the primary row itself from
 * the entry's own `objectType`/`objectId`, and `log_entry_objects_primary_unique` allows
 * exactly one per entry — so a ref naming a *different* object as primary is not a
 * mislabelled row, it is a constraint violation that rolls back the business transaction
 * it was composed into, reported as an opaque P2002. Making it unrepresentable is cheaper
 * than diagnosing that.
 *
 * Derived from `LogRefRole` rather than listed again, so adding a role there cannot
 * silently miss this.
 */
const logRefRoleInputSchema = LogRefRole.schema.exclude(["primary"]);

export const LogRefRoleInput = {
    values: logRefRoleInputSchema.options,
    schema: logRefRoleInputSchema,
} as const;

export type LogRefRoleInput = z.infer<typeof logRefRoleInputSchema>;

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
    D4HAccessToken: "admin",
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
