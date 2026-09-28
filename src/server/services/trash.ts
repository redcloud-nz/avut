/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The server half of the Rubbish bin (#258, #298): one handler per entry in
 * `src/lib/trash-registry.ts`, so listing, recovering, and purging are loops over the registry
 * rather than a branch per entity type at every call site.
 *
 * Purge is the only thing in AVUT that physically removes a trashable row, and it leans on the
 * schema's `onDelete: Cascade` relations to take the row's own children with it. Where a
 * cascade would reach data that isn't the record's own, the handler either re-points it first
 * (a purged Person's assessed skill checks keep an `assessorLabel`) or refuses the purge
 * (`purgeBlocker` — a skill that another organization has recorded checks against).
 */

import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { Operations } from "@/lib/operations";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { TrashableEntities, type TrashableEntityId } from "@/lib/trash-registry";
import { createLogBatch } from "@/server/log-entry";

import * as I3Templates from "./i3-templates";
import * as OrgSettings from "./organization-settings";
import * as Personnel from "./personnel";
import { unattendedOrgContext, type OrgServiceContext } from "./service-context";
import * as SkillPackages from "./skill-packages";
import * as Teams from "./teams";

/**
 * What a purge needs from its context. Narrower than `OrgServiceContext` because the daily
 * auto-purge runs with no user — its `logEvent` writes an actor-less entry inside a `LogBatch`.
 */
export type TrashPurgeContext = Pick<OrgServiceContext, "prisma" | "organizationId" | "logEvent">;

/** What listing and checking need — no logging. */
export type TrashReadContext = Pick<OrgServiceContext, "prisma" | "organizationId">;

/** A `Deleted` row as the Rubbish bin lists it, before `deletedAt`/`purgeAt` are resolved. */
export interface TrashItem {
    type: TrashableEntityId;
    id: string;
    name: string;
    /** Only set for `teamMembership` rows. */
    teamId?: string;
    personId?: string;
    /** Only set for `skillGroup`/`skill` rows. */
    skillPackageId?: string;
}

interface TrashHandler {
    /** Every `Deleted` row of this type in the organization. */
    list(ctx: TrashReadContext): Promise<TrashItem[]>;
    /** The row's status and name, scoped to the organization, or `null` if it isn't there. */
    find(ctx: TrashReadContext, id: string): Promise<{ status: string; name: string } | null>;
    recover(ctx: OrgServiceContext, id: string): Promise<void>;
    /**
     * Why this row can't be purged right now, or `null` if it can. Checked by both the manual
     * "Delete forever" and the auto-purge, which leaves a blocked row in the bin.
     */
    purgeBlocker(ctx: TrashReadContext, id: string): Promise<string | null>;
    /** Physically delete the row (cascading its own children) and log the `Purge`. */
    purge(ctx: TrashPurgeContext, id: string, name: string): Promise<void>;
}

const deletedIn = (ctx: TrashReadContext) => ({
    organizationId: ctx.organizationId,
    status: "Deleted" as const,
});

function purgeLog(
    ctx: TrashPurgeContext,
    type: TrashableEntityId,
    id: string,
    name: string,
): ReturnType<TrashPurgeContext["logEvent"]> {
    const entity = TrashableEntities[type];
    return ctx.logEvent({
        action: "Purge",
        objectType: entity.objectType,
        objectId: id,
        description: `${entity.label} "${name}" permanently deleted from the Rubbish bin.`,
    });
}

/**
 * Skill checks recorded by *another* organization against skills in scope — the one purge
 * cascade that would destroy someone else's records. Skill content isn't personal information,
 * so holding the row back indefinitely is fine under IPP 9.
 */
async function otherOrgCheckBlocker(
    ctx: TrashReadContext,
    skillWhere: { skillPackageId?: string; skillGroupId?: string; id?: string },
    label: string,
): Promise<string | null> {
    const count = await ctx.prisma.skillCheck.count({
        where: { organizationId: { not: ctx.organizationId }, skill: skillWhere },
    });
    return count > 0
        ? `Other organisations have recorded ${count} skill check${count == 1 ? "" : "s"} against this ${label}, so it can't be permanently deleted.`
        : null;
}

const handlers: Record<TrashableEntityId, TrashHandler> = {
    person: {
        async list(ctx) {
            const rows = await ctx.prisma.person.findMany({
                where: deletedIn(ctx),
                select: { id: true, name: true },
            });
            return rows.map((r) => ({ type: "person", ...r }));
        },
        find: (ctx, id) =>
            ctx.prisma.person.findUnique({
                where: { id, organizationId: ctx.organizationId },
                select: { status: true, name: true },
            }),
        async recover(ctx, id) {
            await Personnel.recover(ctx, PersonId.schema.parse(id));
        },
        purgeBlocker: async () => null,
        async purge(ctx, id, name) {
            await ctx.prisma.$transaction([
                // Checks they assessed belong to the assessee — keep them, with the name.
                // `assessorId` itself is nulled by the FK's `onDelete: SetNull`.
                ctx.prisma.skillCheck.updateMany({
                    where: { assessorId: id },
                    data: { assessorLabel: name },
                }),
                purgeLog(ctx, "person", id, name),
                ctx.prisma.person.delete({ where: { id } }),
            ]);
        },
    },
    team: {
        async list(ctx) {
            const rows = await ctx.prisma.team.findMany({
                where: deletedIn(ctx),
                select: { id: true, name: true },
            });
            return rows.map((r) => ({ type: "team", ...r }));
        },
        find: (ctx, id) =>
            ctx.prisma.team.findUnique({
                where: { id, organizationId: ctx.organizationId },
                select: { status: true, name: true },
            }),
        async recover(ctx, id) {
            await Teams.recover(ctx, TeamId.schema.parse(id));
        },
        purgeBlocker: async () => null,
        async purge(ctx, id, name) {
            await ctx.prisma.$transaction([
                purgeLog(ctx, "team", id, name),
                ctx.prisma.team.delete({ where: { id } }),
            ]);
        },
    },
    teamMembership: {
        async list(ctx) {
            const rows = await ctx.prisma.teamMembership.findMany({
                where: deletedIn(ctx),
                select: {
                    id: true,
                    teamId: true,
                    personId: true,
                    team: { select: { name: true } },
                    person: { select: { name: true } },
                },
            });
            return rows.map((m) => ({
                type: "teamMembership",
                id: m.id,
                name: `${m.person.name} in ${m.team.name}`,
                teamId: m.teamId,
                personId: m.personId,
            }));
        },
        async find(ctx, id) {
            const row = await ctx.prisma.teamMembership.findUnique({
                where: { id, organizationId: ctx.organizationId },
                select: {
                    status: true,
                    team: { select: { name: true } },
                    person: { select: { name: true } },
                },
            });
            return row && { status: row.status, name: `${row.person.name} in ${row.team.name}` };
        },
        async recover(ctx, id) {
            const row = await ctx.prisma.teamMembership.findUnique({
                where: {
                    id: TeamMembershipId.schema.parse(id),
                    organizationId: ctx.organizationId,
                },
                select: { teamId: true, personId: true },
            });
            if (!row) throw new NotFoundError(`TeamMembership(${id}) not found.`);
            await Teams.recoverMembership(
                ctx,
                TeamId.schema.parse(row.teamId),
                PersonId.schema.parse(row.personId),
            );
        },
        purgeBlocker: async () => null,
        async purge(ctx, id, name) {
            await ctx.prisma.$transaction([
                purgeLog(ctx, "teamMembership", id, name),
                ctx.prisma.teamMembership.delete({ where: { id } }),
            ]);
        },
    },
    i3Template: {
        async list(ctx) {
            const rows = await ctx.prisma.i3Template.findMany({
                where: deletedIn(ctx),
                select: { id: true, name: true },
            });
            return rows.map((r) => ({ type: "i3Template", ...r }));
        },
        find: (ctx, id) =>
            ctx.prisma.i3Template.findUnique({
                where: { id, organizationId: ctx.organizationId },
                select: { status: true, name: true },
            }),
        async recover(ctx, id) {
            await I3Templates.recover(ctx, I3TemplateId.schema.parse(id));
        },
        purgeBlocker: async () => null,
        async purge(ctx, id, name) {
            await ctx.prisma.$transaction([
                purgeLog(ctx, "i3Template", id, name),
                ctx.prisma.i3Template.delete({ where: { id } }),
            ]);
        },
    },
    skillPackage: {
        async list(ctx) {
            const rows = await ctx.prisma.skillPackage.findMany({
                where: deletedIn(ctx),
                select: { id: true, name: true },
            });
            return rows.map((r) => ({ type: "skillPackage", ...r }));
        },
        find: (ctx, id) =>
            ctx.prisma.skillPackage.findUnique({
                where: { id, organizationId: ctx.organizationId },
                select: { status: true, name: true },
            }),
        async recover(ctx, id) {
            await SkillPackages.recoverPackage(ctx, SkillPackageId.schema.parse(id));
        },
        purgeBlocker: (ctx, id) => otherOrgCheckBlocker(ctx, { skillPackageId: id }, "package"),
        async purge(ctx, id, name) {
            // Cascades its groups, skills, this org's checks against them, and every
            // organization's (now pointless) subscription to it.
            await ctx.prisma.$transaction([
                purgeLog(ctx, "skillPackage", id, name),
                ctx.prisma.skillPackage.delete({ where: { id } }),
            ]);
        },
    },
    skillGroup: {
        async list(ctx) {
            const rows = await ctx.prisma.skillGroup.findMany({
                where: {
                    skillPackage: { organizationId: ctx.organizationId },
                    status: "Deleted",
                },
                select: { id: true, name: true, skillPackageId: true },
            });
            return rows.map((r) => ({ type: "skillGroup", ...r }));
        },
        find: (ctx, id) =>
            ctx.prisma.skillGroup.findFirst({
                where: { id, skillPackage: { organizationId: ctx.organizationId } },
                select: { status: true, name: true },
            }),
        async recover(ctx, id) {
            await SkillPackages.recoverGroup(ctx, SkillGroupId.schema.parse(id));
        },
        purgeBlocker: (ctx, id) => otherOrgCheckBlocker(ctx, { skillGroupId: id }, "group"),
        async purge(ctx, id, name) {
            await ctx.prisma.$transaction([
                purgeLog(ctx, "skillGroup", id, name),
                ctx.prisma.skillGroup.delete({ where: { id } }),
            ]);
        },
    },
    skill: {
        async list(ctx) {
            const rows = await ctx.prisma.skill.findMany({
                where: {
                    skillPackage: { organizationId: ctx.organizationId },
                    status: "Deleted",
                },
                select: { id: true, name: true, skillPackageId: true },
            });
            return rows.map((r) => ({ type: "skill", ...r }));
        },
        find: (ctx, id) =>
            ctx.prisma.skill.findFirst({
                where: { id, skillPackage: { organizationId: ctx.organizationId } },
                select: { status: true, name: true },
            }),
        async recover(ctx, id) {
            await SkillPackages.recoverSkill(ctx, SkillId.schema.parse(id));
        },
        purgeBlocker: (ctx, id) => otherOrgCheckBlocker(ctx, { id }, "skill"),
        async purge(ctx, id, name) {
            await ctx.prisma.$transaction([
                purgeLog(ctx, "skill", id, name),
                ctx.prisma.skill.delete({ where: { id } }),
            ]);
        },
    },
};

/** The org's Rubbish-bin retention window, in days. */
export async function getRetentionDays(ctx: TrashReadContext) {
    const settings = await OrgSettings.read(ctx.prisma, ctx.organizationId);
    return settings.rubbishBin.retentionDays;
}

/**
 * When each item was deleted, from the latest `Delete` entry in `log_entries` — one query,
 * never per row (#258 derives provenance from the log rather than a `deletedAt` column).
 */
async function resolveDeletedAt(
    ctx: Pick<TrashPurgeContext, "prisma">,
    items: TrashItem[],
): Promise<Map<string, Date>> {
    const deletedAt = new Map<string, Date>();
    if (items.length === 0) return deletedAt;

    const entries = await ctx.prisma.logEntry.findMany({
        where: {
            objectType: {
                in: [...new Set(items.map((i) => TrashableEntities[i.type].objectType))],
            },
            objectId: { in: items.map((i) => i.id) },
            action: "Delete",
        },
        orderBy: { sequence: "desc" },
        select: { objectType: true, objectId: true, timestamp: true },
    });
    for (const entry of entries) {
        const key = `${entry.objectType}:${entry.objectId}`;
        if (!deletedAt.has(key)) deletedAt.set(key, entry.timestamp);
    }
    return deletedAt;
}

function itemKey(item: TrashItem) {
    return `${TrashableEntities[item.type].objectType}:${item.id}`;
}

function addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Every `Deleted` row of the given types, with when it was deleted and when the auto-purge
 * will remove it. Either date is `null` for a row with no `Delete` log entry — such a row is
 * never auto-purged (see `purgeExpired`).
 */
export async function list(
    ctx: TrashReadContext,
    types: readonly TrashableEntityId[],
): Promise<(TrashItem & { deletedAt: Date | null; purgeAt: Date | null })[]> {
    const items = (await Promise.all(types.map((type) => handlers[type].list(ctx)))).flat();
    if (items.length === 0) return [];

    const [deletedAt, retentionDays] = await Promise.all([
        resolveDeletedAt(ctx, items),
        getRetentionDays(ctx),
    ]);

    return items.map((item) => {
        const at = deletedAt.get(itemKey(item)) ?? null;
        return { ...item, deletedAt: at, purgeAt: at && addDays(at, retentionDays) };
    });
}

async function requireDeleted(ctx: TrashReadContext, type: TrashableEntityId, id: string) {
    const row = await handlers[type].find(ctx, id);
    if (!row) throw new NotFoundError(`${TrashableEntities[type].objectType}(${id}) not found.`);
    if (row.status !== "Deleted") {
        throw new ValidationError(
            `${TrashableEntities[type].objectType}(${id}) has status ${row.status}; only a Deleted record is in the Rubbish bin.`,
        );
    }
    return row;
}

/** Recover a `Deleted` row back to `Active`, through the entity's own service. */
export async function recover(
    ctx: OrgServiceContext,
    type: TrashableEntityId,
    id: string,
): Promise<void> {
    await requireDeleted(ctx, type, id);
    await handlers[type].recover(ctx, id);
}

/**
 * Permanently delete a `Deleted` row ("Delete forever").
 * @throws NotFoundError if the row doesn't exist in the organization.
 * @throws ValidationError if it isn't `Deleted`, or a `purgeBlocker` refuses it.
 */
export async function purge(
    ctx: TrashPurgeContext,
    type: TrashableEntityId,
    id: string,
): Promise<void> {
    const row = await requireDeleted(ctx, type, id);
    const blocker = await handlers[type].purgeBlocker(ctx, id);
    if (blocker) throw new ValidationError(blocker);
    await handlers[type].purge(ctx, id, row.name);
}

export interface PurgeRunSummary {
    purged: { type: TrashableEntityId; id: string }[];
    /** Past their window but held back by a `purgeBlocker`. */
    blocked: { type: TrashableEntityId; id: string; reason: string }[];
    /** No `Delete` log entry, so no known deletion date — never auto-purged. */
    undated: { type: TrashableEntityId; id: string }[];
    failed: { type: TrashableEntityId; id: string; error: string }[];
}

/**
 * The auto-purge for one organization: every trashable row whose retention window has passed.
 * Idempotent, and one row failing doesn't stop the rest.
 */
export async function purgeExpired(
    ctx: TrashPurgeContext,
    now: Date,
    types: readonly TrashableEntityId[] = Object.keys(handlers) as TrashableEntityId[],
): Promise<PurgeRunSummary> {
    const summary: PurgeRunSummary = { purged: [], blocked: [], undated: [], failed: [] };

    for (const item of await list(ctx, types)) {
        const ref = { type: item.type, id: item.id };
        if (item.purgeAt == null) {
            summary.undated.push(ref);
            continue;
        }
        if (item.purgeAt > now) continue;

        try {
            // Re-read: an earlier purge in this run may have cascaded it away (a Deleted team's
            // Deleted memberships), or someone recovered it since the list was taken.
            const current = await handlers[item.type].find(ctx, item.id);
            if (current?.status !== "Deleted") continue;

            const blocker = await handlers[item.type].purgeBlocker(ctx, item.id);
            if (blocker) {
                summary.blocked.push({ ...ref, reason: blocker });
                continue;
            }
            await handlers[item.type].purge(ctx, item.id, item.name);
            summary.purged.push(ref);
        } catch (error) {
            summary.failed.push({
                ...ref,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return summary;
}

/** One organization's part of an auto-purge run: its summary, or why it couldn't run at all. */
export type AutoPurgeResult =
    | { organizationId: string; summary: PurgeRunSummary; error?: never }
    | { organizationId: string; error: string; summary?: never };

/**
 * The daily auto-purge across every organization (`/api/cron/purge-rubbish`). Each org whose bin
 * has something past its window gets its own `rubbish-purge` `LogBatch`, so an unattended purge
 * is still traceable; an org with nothing due writes nothing.
 */
export async function runAutoPurge(prisma: PrismaClient, now: Date): Promise<AutoPurgeResult[]> {
    const allTypes = Object.keys(handlers) as TrashableEntityId[];
    const organizations = await prisma.organization.findMany({ select: { id: true } });
    const results: AutoPurgeResult[] = [];

    for (const { id } of organizations) {
        const organizationId = OrganizationId.schema.parse(id);
        try {
            // Read-only check first, so an org with nothing due gets no empty batch.
            const due = (await list({ prisma, organizationId }, allTypes)).some(
                (item) => item.purgeAt != null && item.purgeAt <= now,
            );
            if (!due) continue;

            const actorLabel = Operations["rubbish-purge"].label;
            const batch = await createLogBatch(
                { operationKey: "rubbish-purge", actorLabel },
                prisma,
            );
            const ctx = unattendedOrgContext(prisma, organizationId, { id: batch.id, actorLabel });
            results.push({ organizationId, summary: await purgeExpired(ctx, now, allTypes) });
        } catch (error) {
            // One organization failing (a bad settings row, say) doesn't stop the rest.
            results.push({
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return results;
}
