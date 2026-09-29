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

import { DiffChange } from "@/lib/diff";
import { Operations } from "@/lib/operations";
import type { LogObjectType } from "@/lib/schemas/log-entry";
import {
    OtherRefObjectType,
    type HistoryObjectType,
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

    const names = await resolveNames(ctx, refRows.flat(), relatedTypes);

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
            changes: changesSchema.parse(row.changes),
            refs: refRows[index].map((ref) => toRef(ref, names)),
        }),
    );

    return { entries, nextCursor };
}

interface StoredRef {
    objectType: string;
    objectId: string;
    role: string;
}

interface ResolvedNames {
    persons: Map<string, PersonRef>;
    teams: Map<string, TeamRef>;
}

/**
 * Names for the `Person`/`Team` refs on a page — at most one `findMany` each, org-scoped, and only
 * for types the caller may view. A ref missing from the result was purged, or isn't viewable.
 */
async function resolveNames(
    ctx: ObjectHistoryContext,
    refs: StoredRef[],
    relatedTypes: readonly LogObjectType[],
): Promise<ResolvedNames> {
    const idsOf = (type: "Person" | "Team") =>
        relatedTypes.includes(type)
            ? [...new Set(refs.filter((r) => r.objectType === type).map((r) => r.objectId))]
            : [];

    const personIds = idsOf("Person");
    const teamIds = idsOf("Team");

    const [persons, teams] = await Promise.all([
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
    ]);

    return {
        persons: new Map(
            persons.map(({ id, name }) => [id, { id: PersonId.schema.parse(id), name }]),
        ),
        teams: new Map(teams.map(({ id, name }) => [id, { id: TeamId.schema.parse(id), name }])),
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
