/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * Recoverable deletion for `User` (#296), shared by the system-admin delete, self-service account
 * closure (#150), the system Rubbish bin, and the daily auto-purge.
 *
 * Delete is soft: `status: Deleted` plus every session revoked, so the account can't be used but
 * is fully intact. It sits in the system Rubbish bin for a fixed `USER_RETENTION_DAYS`, then the
 * purge runs what used to be `deleteUser`'s hard delete. Ban/unban is a different tool — it blocks
 * access indefinitely and schedules nothing.
 *
 * Every entry here is `scope: "system"`: a purge cascades `LogEntry.ownerId`, so a user-scoped
 * entry about the account would be destroyed along with it (see `src/trpc/CLAUDE.md`).
 */

import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { Operations } from "@/lib/operations";
import type { LogEntryRecord } from "@/lib/schemas/log-entry";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { USER_RETENTION_DAYS, type UserId } from "@/lib/schemas/user";
import { createLogBatch, formatActorLabel, recordLogEntry } from "@/server/log-entry";

import type { LogEventOptions } from "./service-context";

export interface SystemServiceContext {
    prisma: PrismaClient;
    /** Writes a `scope: "system"` entry — the only scope that survives the account's purge. */
    logSystemEvent: (
        options: LogEventOptions,
        tx?: Prisma.TransactionClient,
    ) => Prisma.PrismaPromise<LogEntryRecord>;
}

async function requireUser(ctx: SystemServiceContext, userId: UserId) {
    const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
            deletedBy: true,
        },
    });
    if (!user) throw new NotFoundError(`User(${userId}) not found.`);
    return user;
}

/**
 * Organizations this user is the only non-deleted owner of. Another owner who is themselves in
 * the Rubbish bin doesn't count — they can't act for the org either.
 */
async function soleOwnedOrganizationNames(
    ctx: SystemServiceContext,
    userId: UserId,
): Promise<string[]> {
    const owned = (
        await ctx.prisma.organizationUser.findMany({
            where: { userId, role: { contains: "owner" } },
            select: { organizationId: true, role: true },
        })
    ).filter((row) => OrganizationRole.includes(row.role, "owner"));
    if (owned.length === 0) return [];

    const otherOwners = (
        await ctx.prisma.organizationUser.findMany({
            where: {
                organizationId: { in: owned.map((o) => o.organizationId) },
                userId: { not: userId },
                role: { contains: "owner" },
                user: { status: { not: "Deleted" } },
            },
            select: { organizationId: true, role: true },
        })
    ).filter((row) => OrganizationRole.includes(row.role, "owner"));
    const covered = new Set(otherOwners.map((o) => o.organizationId));

    const soleIds = owned.map((o) => o.organizationId).filter((id) => !covered.has(id));
    if (soleIds.length === 0) return [];
    const orgs = await ctx.prisma.organization.findMany({
        where: { id: { in: soleIds } },
        select: { name: true },
    });
    return orgs.map((o) => o.name).sort();
}

/**
 * Why this account can't be deleted (or purged) right now, or `null`.
 * - the last system administrator who isn't in the Rubbish bin;
 * - the sole owner of an organization (the message names them, per #150).
 */
export async function getDeleteBlocker(
    ctx: SystemServiceContext,
    userId: UserId,
): Promise<string | null> {
    const user = await requireUser(ctx, userId);

    if (user.role === "admin") {
        const otherAdmins = await ctx.prisma.user.count({
            where: { role: "admin", id: { not: userId }, status: { not: "Deleted" } },
        });
        if (otherAdmins === 0) return "Cannot delete the last system administrator.";
    }

    const soleOwned = await soleOwnedOrganizationNames(ctx, userId);
    if (soleOwned.length > 0) {
        return `${user.name} is the only owner of ${soleOwned.join(", ")}. Transfer ownership or delete the organisation first.`;
    }

    return null;
}

/**
 * Soft-delete an account into the system Rubbish bin: `status: Deleted` and every session
 * revoked, in one transaction. Memberships, person links and settings are left untouched, so
 * recovering is just flipping the status back. No-op if already `Deleted`.
 * @throws ValidationError if `getDeleteBlocker` refuses it.
 */
export async function softDelete(
    ctx: SystemServiceContext,
    userId: UserId,
    closedBy: "admin" | "self",
): Promise<void> {
    const user = await requireUser(ctx, userId);
    if (user.status === "Deleted") return;

    const blocker = await getDeleteBlocker(ctx, userId);
    if (blocker) throw new ValidationError(blocker);

    const subject = formatActorLabel(user.name, user.email);
    await ctx.prisma.$transaction([
        ctx.prisma.user.update({
            where: { id: userId },
            data: { status: "Deleted", deletedBy: closedBy === "self" ? "Self" : "Admin" },
        }),
        ctx.prisma.session.deleteMany({ where: { userId } }),
        ctx.logSystemEvent({
            action: "Delete",
            objectType: "User",
            objectId: userId,
            description:
                closedBy === "self"
                    ? `Account ${subject} closed by its owner.`
                    : `Account ${subject} deleted by a system administrator.`,
        }),
    ]);
}

/**
 * Recover a `Deleted` account back to `Active` (a system administrator, from the system bin).
 * The account comes back exactly as it was — memberships included.
 * @throws ValidationError if the account isn't `Deleted`.
 */
export async function recover(ctx: SystemServiceContext, userId: UserId): Promise<void> {
    const user = await requireUser(ctx, userId);
    if (user.status !== "Deleted") {
        throw new ValidationError(`User(${userId}) isn't in the Rubbish bin.`);
    }
    await setActive(ctx, user, "recovered from the Rubbish bin");
}

/**
 * The account holder restoring their own account from the sign-in screen. Only an account they
 * closed themselves — one a system administrator deleted stays that administrator's call.
 * @throws ValidationError if the account isn't `Deleted`, or wasn't closed by its owner.
 */
export async function restoreOwn(ctx: SystemServiceContext, userId: UserId): Promise<void> {
    const user = await requireUser(ctx, userId);
    if (user.status !== "Deleted") {
        throw new ValidationError("This account isn't closed.");
    }
    if (user.deletedBy !== "Self") {
        throw new ValidationError(
            "This account was deleted by an administrator. Contact them to have it restored.",
        );
    }
    await setActive(ctx, user, "restored by its owner");
}

async function setActive(
    ctx: SystemServiceContext,
    user: { id: string; name: string; email: string },
    how: string,
) {
    await ctx.prisma.$transaction([
        ctx.prisma.user.update({
            where: { id: user.id },
            data: { status: "Active", deletedBy: null },
        }),
        ctx.logSystemEvent({
            action: "Recover",
            objectType: "User",
            objectId: user.id,
            description: `Account ${formatActorLabel(user.name, user.email)} ${how}.`,
        }),
    ]);
}

/**
 * Permanently delete a `Deleted` account — what `deleteUser` used to do immediately.
 *
 * The delete guard is re-run first: an account that has since become the sole owner of an
 * organization (its co-owner left, say) is refused rather than purged into an ownerless org.
 *
 * Every FK into `User` is `Cascade` or `SetNull`, but the dependent rows are still cleared
 * explicitly so the behaviour is pinned here rather than depending on the database's cascade
 * config. Log entries are deliberately left to the FKs: `LogEntry.userId` is `SetNull` (their
 * actions survive, with `actorLabel`), `ownerId` is `Cascade` (their own timeline goes).
 * @throws ValidationError if the account isn't `Deleted`, or the guard refuses it.
 */
export async function purge(ctx: SystemServiceContext, userId: UserId): Promise<void> {
    const user = await requireUser(ctx, userId);
    if (user.status !== "Deleted") {
        throw new ValidationError(`User(${userId}) isn't in the Rubbish bin.`);
    }

    const blocker = await getDeleteBlocker(ctx, userId);
    if (blocker) throw new ValidationError(blocker);

    await ctx.prisma.$transaction([
        ctx.prisma.formInstance.updateMany({ where: { userId }, data: { userId: null } }),
        ctx.prisma.session.deleteMany({ where: { userId } }),
        ctx.prisma.account.deleteMany({ where: { userId } }),
        ctx.prisma.organizationUser.deleteMany({ where: { userId } }),
        ctx.prisma.organizationInvitation.deleteMany({ where: { inviterId: userId } }),
        ctx.prisma.providerCredential.deleteMany({ where: { userId } }),
        ctx.prisma.note.deleteMany({ where: { authorId: userId } }),
        ctx.prisma.userConfig.deleteMany({ where: { userId } }),
        ctx.logSystemEvent({
            action: "Purge",
            objectType: "User",
            objectId: userId,
            description: `Account ${formatActorLabel(user.name, user.email)} permanently deleted from the Rubbish bin.`,
        }),
        ctx.prisma.user.delete({ where: { id: userId } }),
    ]);
}

export interface DeletedUser {
    id: string;
    name: string;
    email: string;
    deletedAt: Date | null;
    purgeAt: Date | null;
}

/** Every account in the system Rubbish bin, with when it was deleted and will be purged. */
export async function listDeleted(prisma: PrismaClient): Promise<DeletedUser[]> {
    const users = await prisma.user.findMany({
        where: { status: "Deleted" },
        select: { id: true, name: true, email: true },
    });
    if (users.length === 0) return [];

    const entries = await prisma.logEntry.findMany({
        where: { objectType: "User", objectId: { in: users.map((u) => u.id) }, action: "Delete" },
        orderBy: { sequence: "desc" },
        select: { objectId: true, timestamp: true },
    });
    const deletedAt = new Map<string, Date>();
    for (const e of entries) if (!deletedAt.has(e.objectId)) deletedAt.set(e.objectId, e.timestamp);

    return users.map((u) => {
        const at = deletedAt.get(u.id) ?? null;
        return {
            ...u,
            deletedAt: at,
            purgeAt: at && new Date(at.getTime() + USER_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        };
    });
}

export interface UserPurgeRunSummary {
    purged: string[];
    blocked: { id: string; reason: string }[];
    /** No `Delete` log entry, so no known deletion date — never auto-purged. */
    undated: string[];
    failed: { id: string; error: string }[];
}

/** The auto-purge for accounts past their window. Idempotent; one failure doesn't stop the rest. */
export async function purgeExpired(
    ctx: SystemServiceContext,
    now: Date,
): Promise<UserPurgeRunSummary> {
    const summary: UserPurgeRunSummary = { purged: [], blocked: [], undated: [], failed: [] };

    for (const user of await listDeleted(ctx.prisma)) {
        if (user.purgeAt == null) {
            summary.undated.push(user.id);
            continue;
        }
        if (user.purgeAt > now) continue;

        const userId = user.id as UserId;
        try {
            const blocker = await getDeleteBlocker(ctx, userId);
            if (blocker) {
                summary.blocked.push({ id: user.id, reason: blocker });
                continue;
            }
            await purge(ctx, userId);
            summary.purged.push(user.id);
        } catch (error) {
            summary.failed.push({
                id: user.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return summary;
}

/**
 * The daily auto-purge for accounts (`/api/cron/purge-rubbish`). Unattended, so its entries are
 * actor-less inside a `rubbish-purge` `LogBatch` — created only when something is due.
 */
export async function runAutoPurge(prisma: PrismaClient, now: Date): Promise<UserPurgeRunSummary> {
    const due = (await listDeleted(prisma)).some((u) => u.purgeAt != null && u.purgeAt <= now);
    if (!due) return { purged: [], blocked: [], undated: [], failed: [] };

    const actorLabel = Operations["rubbish-purge"].label;
    const batch = await createLogBatch({ operationKey: "rubbish-purge", actorLabel }, prisma);
    return purgeExpired(
        {
            prisma,
            logSystemEvent: (options, tx = prisma) =>
                recordLogEntry(
                    { scope: "system", actor: null, actorLabel, ...options, batchId: batch.id },
                    tx,
                ),
        },
        now,
    );
}
