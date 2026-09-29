/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { DiffChange } from "@/lib/diff";
import type { Permissions } from "@/lib/permissions";

import type { LogObjectType } from "./log-entry";
import { PersonRef } from "./person";
import { TeamRef } from "./team";

/**
 * The object types that have a History page (#48). Adding one is an entry here, in
 * `HistoryObjects`, plus a page.
 */
const historyObjectTypeValues = [
    "D4HAccessToken",
    "Person",
    "SkillCheckSession",
    "SkillPackage",
    "Team",
] as const satisfies readonly LogObjectType[];

export const HistoryObjectType = {
    values: historyObjectTypeValues,
    schema: z.enum(historyObjectTypeValues),
} as const;

export type HistoryObjectType = (typeof historyObjectTypeValues)[number];

/**
 * Who may read an object's history: whoever can view the object. Each entry is the permission
 * the detail page's own getter already requires, so anyone on the detail page can open its
 * History page without a separate `<Protect>`.
 */
export const HistoryObjects: Record<HistoryObjectType, { permissions: Permissions }> = {
    // d4hAccessTokens.getOrganizationAccessToken
    D4HAccessToken: { permissions: { organization: ["update"] } },
    // personnel.getPerson
    Person: { permissions: { person: ["view"] } },
    // skillCheckSessions.getSession
    SkillCheckSession: { permissions: { skillCheckSession: ["view"] } },
    // skillPackageBuilder.getPackage
    SkillPackage: { permissions: { skillPackage: ["view"] } },
    // teams.getTeam
    Team: { permissions: { team: ["view"] } },
};

/**
 * The page permission only covers entries about the object itself. A *related* entry (one that
 * reaches this object through a `context` ref) is shown only if the caller can also view the
 * entry's own object type — without this, a `TeamMembership` entry would leak team names to a
 * role that can see personnel but not teams. `Person`/`Team` ref names are gated the same way.
 *
 * An object type missing from this map passes through unfiltered.
 */
export const RelatedEntryPermissions: Partial<Record<LogObjectType, Permissions>> = {
    // Person ↔ user link entries carry a user id in their description.
    OrganizationMembership: { member: ["view"] },
    TeamMembership: { team: ["view"] },
    // Defensive: every role with `team:view` has `person:view` today, and vice versa for the
    // roles that reach a Person's history.
    Person: { person: ["view"] },
    Team: { team: ["view"] },
};

/**
 * A ref object type other than `Person`/`Team`. Branded so that `ref.objectType === "Person"`
 * narrows `ObjectHistoryRef` to its `Person` member — a plain `string` would swallow the literal
 * and leave `ref.person` unreachable without a cast.
 */
const otherRefObjectTypeSchema = z
    .string()
    .refine((type) => type !== "Person" && type !== "Team", "Person/Team refs have their own shape")
    .brand<"OtherRefObjectType">();

export const OtherRefObjectType = {
    schema: otherRefObjectTypeSchema,
} as const;

export type OtherRefObjectType = z.infer<typeof otherRefObjectTypeSchema>;

/**
 * Another object an entry mentions. `person`/`team` is `null` when the record has since been
 * purged or the caller can't view that type; the UI then renders plain text, not a link. Any other
 * type is shown by type only. `role` is a plain string (not `LogRefRole`) so a retired value on a
 * historical row renders verbatim instead of failing the page.
 */
export const ObjectHistoryRef = {
    schema: z.union([
        z.object({
            objectType: z.literal("Person"),
            role: z.string(),
            person: PersonRef.schema.nullable(),
        }),
        z.object({
            objectType: z.literal("Team"),
            role: z.string(),
            team: TeamRef.schema.nullable(),
        }),
        z.object({
            objectType: otherRefObjectTypeSchema,
            role: z.string(),
            objectId: z.string(),
        }),
    ]),
} as const;

export type ObjectHistoryRef = z.infer<typeof ObjectHistoryRef.schema>;

/**
 * One log entry as a History page shows it.
 *
 * `action` and `objectType` are plain strings, not `LogAction`/`LogObjectType`: stored rows are
 * read leniently, so a retired value renders verbatim rather than failing the whole page.
 */
export const ObjectHistoryEntry = {
    schema: z.object({
        id: z.string(),
        sequence: z.number().int(),
        action: z.string(),
        objectType: z.string(),
        objectId: z.string(),
        /** `primary` when the entry is about the asked-for object, `related` when it only mentions it. */
        relation: z.enum(["primary", "related"]),
        /** The acting user's name — never their email. */
        actorName: z.string().nullable(),
        impersonatorName: z.string().nullable(),
        /** The `Operations` label of the entry's batch, if it has one. */
        operationLabel: z.string().nullable(),
        description: z.string().nullable(),
        timestamp: z.date(),
        changes: z.array(DiffChange.schema),
        /** The entry's other objects — excluding the asked-for object and the entry's own. */
        refs: z.array(ObjectHistoryRef.schema),
    }),
} as const;

export type ObjectHistoryEntry = z.infer<typeof ObjectHistoryEntry.schema>;

export const ObjectHistoryPage = {
    schema: z.object({
        entries: z.array(ObjectHistoryEntry.schema),
        /** Pass as `cursor` to fetch the next (older) page; `null` on the last page. */
        nextCursor: z.number().int().nullable(),
    }),
} as const;

export type ObjectHistoryPage = z.infer<typeof ObjectHistoryPage.schema>;
