/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The read side of the audit log for per-object History pages (#48).
 *
 * Nothing here re-asserts `recordLogEntry`'s write-time invariants (see the header of
 * `src/server/log-entry.ts`): stored rows are read leniently, so one malformed or retired-value
 * historical row renders plainly instead of failing the page.
 */

import "server-only";

import * as z from "zod";

import { DiffChange, type DiffValues } from "@/lib/diff";
import { Operations } from "@/lib/operations";
import type { LogObjectType } from "@/lib/schemas/log-entry";
import {
    idFieldTarget,
    OtherRefObjectType,
    type HistoryObjectType,
    type IdFieldTarget,
    type ObjectHistoryEntry,
    type ObjectHistoryPage,
    type ObjectHistoryRef,
} from "@/lib/schemas/object-history";
import { PersonId, type PersonRef } from "@/lib/schemas/person";
import { TeamId, type TeamRef } from "@/lib/schemas/team";

import type { OrgServiceContext } from "./service-context";

/** Reading the log needs no actor and writes nothing. */
export type ObjectHistoryContext = Pick<OrgServiceContext, "prisma" | "organizationId">;

export interface ListObjectHistoryInput {
    objectType: HistoryObjectType;
    objectId: string;
    /**
     * The object types whose *related* entries the caller may see — the mapped types in
     * `RelatedEntryPermissions` the caller holds, plus every type that map doesn't list. Entries
     * about the object itself always pass. Also gates `Person`/`Team` ref name resolution.
     */
    relatedTypes: readonly LogObjectType[];
    /** The `sequence` of the last entry on the previous page. */
    cursor?: number;
    limit: number;
}

const changesSchema = z.array(DiffChange.schema).catch([]);

/**
 * Every log entry about an object in this organization, or mentioning it through a ref, newest
 * first.
 *
 * - Always org-scoped: a `SkillPackage` shared through subscriptions never shows another org's
 *   entries about it.
 * - Paged keyset-style on `sequence`. `sequence` is drawn at INSERT, not commit, so a
 *   concurrently committed lower row can be missed from an older page. That's acceptable for a
 *   human-read "Load more"; don't reuse this as a sync cursor.
 * - `actorName` is the user's current name, or — when `userId` has since been nulled by the
 *   user's deletion (`onDelete: SetNull`) — `actorLabel` with its trailing ` <email>` stripped.
 *   Never an email.
 * - `changes` that fail to parse come back as `[]`.
 */
export async function list(
    ctx: ObjectHistoryContext,
    { objectType, objectId, relatedTypes, cursor, limit }: ListObjectHistoryInput,
): Promise<ObjectHistoryPage> {
    const rows = await ctx.prisma.logEntry.findMany({
        where: {
            organizationId: ctx.organizationId,
            objects: { some: { objectType, objectId } },
            OR: [{ objectType, objectId }, { objectType: { in: [...relatedTypes] } }],
            ...(cursor === undefined ? {} : { sequence: { lt: cursor } }),
        },
        orderBy: { sequence: "desc" },
        take: limit + 1,
        select: {
            id: true,
            sequence: true,
            action: true,
            objectType: true,
            objectId: true,
            actorLabel: true,
            description: true,
            timestamp: true,
            changes: true,
            user: { select: { name: true } },
            impersonator: { select: { name: true } },
            batch: { select: { operationKey: true } },
            objects: { select: { objectType: true, objectId: true, role: true } },
        },
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].sequence : null;

    const isAskedFor = (ref: { objectType: string; objectId: string }) =>
        ref.objectType === objectType && ref.objectId === objectId;

    const refRows = page.map((row) =>
        row.objects.filter((ref) => ref.role !== "primary" && !isAskedFor(ref)),
    );

    const changes = page.map((row) => changesSchema.parse(row.changes));

    const names = await resolveNames(
        ctx,
        refRows.flat(),
        relatedTypes,
        collectIdFieldIds(page.map((row, index) => ({ row, changes: changes[index] }))),
    );

    const entries = page.map(
        (row, index): ObjectHistoryEntry => ({
            id: row.id,
            sequence: row.sequence,
            action: row.action,
            objectType: row.objectType,
            objectId: row.objectId,
            relation: isAskedFor(row) ? "primary" : "related",
            actorName: row.user?.name ?? stripEmail(row.actorLabel),
            impersonatorName: row.impersonator?.name ?? null,
            operationLabel: row.batch ? operationLabel(row.batch.operationKey) : null,
            description: row.description,
            timestamp: row.timestamp,
            changes: changes[index],
            refs: refRows[index].map((ref) => toRef(ref, names)),
        }),
    );

    return {
        entries,
        nextCursor,
        names: {
            Person: Object.fromEntries(names.idFieldPersons),
            Skill: Object.fromEntries(names.idFieldSkills),
        },
    };
}

type IdFieldIds = Record<IdFieldTarget, Set<string>>;

/**
 * The string ids in a page's `IdFields` changes, by target type: `arr_add`/`arr_del` values,
 * `obj_*`/`arr_ord` `prev`/`curr`, and each element of an array value. Anything that isn't a
 * string (a `null` prev, say) is skipped.
 */
function collectIdFieldIds(
    rows: { row: { objectType: string }; changes: DiffChange[] }[],
): IdFieldIds {
    const ids: IdFieldIds = { Person: new Set(), Skill: new Set() };

    for (const { row, changes } of rows) {
        for (const change of changes) {
            const target = idFieldTarget(row.objectType, change.path);
            if (!target) continue;

            const values: DiffValues[] = [];
            switch (change.type) {
                case "arr_add":
                case "arr_del":
                    values.push(change.value);
                    break;
                case "obj_add":
                    values.push(change.curr);
                    break;
                case "obj_del":
                    values.push(change.prev);
                    break;
                case "obj_mod":
                case "arr_ord":
                    values.push(change.prev, change.curr);
                    break;
                case "obj_mask":
                    break;
            }

            for (const value of values.flat()) {
                if (typeof value === "string") ids[target].add(value);
            }
        }
    }

    return ids;
}

interface StoredRef {
    objectType: string;
    objectId: string;
    role: string;
}

interface ResolvedNames {
    /** `Person` refs, only those the caller may view. */
    persons: Map<string, PersonRef>;
    /** `Team` refs, only those the caller may view. */
    teams: Map<string, TeamRef>;
    /** Names for the `Person` ids in `IdFields` changes. */
    idFieldPersons: Map<string, string>;
    /** Names for the `Skill` ids in `IdFields` changes. */
    idFieldSkills: Map<string, string>;
}

/**
 * Names for a page — at most one `findMany` per type, all org-scoped:
 *
 * - `Person`/`Team` refs, only for types the caller may view. A ref missing from the result was
 *   purged, or isn't viewable.
 * - Ids in `IdFields` changes, with no extra gate: whoever can view the page's object already sees
 *   these names on its own detail page (a session lists its assessees and skills). Person ids share
 *   the ref lookup; skills are matched in packages the org owns *or* subscribes to, since a session
 *   can use a subscribed package's skills. An id not found is absent.
 */
async function resolveNames(
    ctx: ObjectHistoryContext,
    refs: StoredRef[],
    relatedTypes: readonly LogObjectType[],
    idFieldIds: IdFieldIds,
): Promise<ResolvedNames> {
    const refIdsOf = (type: "Person" | "Team") =>
        relatedTypes.includes(type)
            ? new Set(refs.filter((r) => r.objectType === type).map((r) => r.objectId))
            : new Set<string>();

    const refPersonIds = refIdsOf("Person");
    const teamIds = [...refIdsOf("Team")];
    const personIds = [...new Set([...refPersonIds, ...idFieldIds.Person])];
    const skillIds = [...idFieldIds.Skill];

    const [persons, teams, skills] = await Promise.all([
        personIds.length === 0
            ? []
            : ctx.prisma.person.findMany({
                  where: { organizationId: ctx.organizationId, id: { in: personIds } },
                  select: { id: true, name: true },
              }),
        teamIds.length === 0
            ? []
            : ctx.prisma.team.findMany({
                  where: { organizationId: ctx.organizationId, id: { in: teamIds } },
                  select: { id: true, name: true },
              }),
        skillIds.length === 0
            ? []
            : ctx.prisma.skill.findMany({
                  where: {
                      id: { in: skillIds },
                      skillPackage: {
                          OR: [
                              { organizationId: ctx.organizationId },
                              {
                                  subscriptions: {
                                      some: { organizationId: ctx.organizationId },
                                  },
                              },
                          ],
                      },
                  },
                  select: { id: true, name: true },
              }),
    ]);

    return {
        // Only the ref ids go in here: a person named in a change but not viewable as a ref
        // (no `Person` in relatedTypes) must still come back as a null ref.
        persons: new Map(
            persons
                .filter(({ id }) => refPersonIds.has(id))
                .map(({ id, name }) => [id, { id: PersonId.schema.parse(id), name }]),
        ),
        teams: new Map(teams.map(({ id, name }) => [id, { id: TeamId.schema.parse(id), name }])),
        idFieldPersons: new Map(
            persons.filter(({ id }) => idFieldIds.Person.has(id)).map(({ id, name }) => [id, name]),
        ),
        idFieldSkills: new Map(skills.map(({ id, name }) => [id, name])),
    };
}

function toRef(ref: StoredRef, names: ResolvedNames): ObjectHistoryRef {
    switch (ref.objectType) {
        case "Person":
            return {
                objectType: "Person",
                role: ref.role,
                person: names.persons.get(ref.objectId) ?? null,
            };
        case "Team":
            return {
                objectType: "Team",
                role: ref.role,
                team: names.teams.get(ref.objectId) ?? null,
            };
        default:
            return {
                objectType: OtherRefObjectType.schema.parse(ref.objectType),
                role: ref.role,
                objectId: ref.objectId,
            };
    }
}

/** `"Name <email>"` → `"Name"`; an operation label passes through unchanged. */
function stripEmail(actorLabel: string | null): string | null {
    if (actorLabel === null) return null;
    return actorLabel.replace(/\s*<[^>]*>$/, "") || null;
}

/** The operation's label, or its raw key if it has since left the `Operations` registry. */
function operationLabel(operationKey: string): string {
    const labels: Partial<Record<string, { label: string }>> = Operations;
    return (Object.hasOwn(labels, operationKey) && labels[operationKey]?.label) || operationKey;
}
