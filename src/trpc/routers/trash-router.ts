/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import {
    TrashableEntities,
    TrashableEntityIdSchema,
    trashableEntityList,
    type TrashableEntityId,
} from "@/lib/trash-registry";
import * as Trash from "@/server/services/trash";

import {
    createTrpcRouter,
    organizationProcedure,
    type AuthenticatedOrganizationContext,
} from "../init";

/**
 * The caller's roles, read through `ctx.prisma` (rather than the cached
 * `getOrganizationUserRolesOrNull`, which reaches the real Prisma singleton) so the router stays
 * testable against the injected mock db like every other procedure.
 */
async function callerRoles(ctx: AuthenticatedOrganizationContext) {
    const orgUser = await ctx.prisma.organizationUser.findUnique({
        where: {
            organizationId_userId: { organizationId: ctx.organizationId, userId: ctx.userId },
        },
        select: { role: true },
    });
    return orgUser ? z.array(OrganizationRole.schema).parse(orgUser.role.split(",")) : [];
}

/** Recover and purge both ride on the entity's `delete` permission (#258). */
async function requireDeletePermission(
    ctx: AuthenticatedOrganizationContext,
    type: TrashableEntityId,
) {
    const { permission } = TrashableEntities[type];
    if (!hasAnyRoleWithPermissions(await callerRoles(ctx), { [permission]: ["delete"] })) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `You need ${permission}:delete to do that.`,
        });
    }
}

const trashRecordInput = z.object({ type: TrashableEntityIdSchema, id: z.string() });

export const trashRouter = createTrpcRouter({
    /**
     * Lists every `Deleted`-status record across the trashable-model registry
     * (`src/lib/trash-registry.ts`) that the caller has `delete` permission on. Entities the
     * caller lacks `delete` permission for are silently omitted, rather than 403ing the whole
     * call — a screen mixing entities of differing permission is expected to show only what the
     * viewer can act on.
     */
    listTrash: organizationProcedure()
        .output(
            z.array(
                z.object({
                    id: z.string(),
                    type: TrashableEntityIdSchema,
                    name: z.string(),
                    deletedAt: z.iso.datetime().nullable(),
                    /** When the daily auto-purge will remove it; null if `deletedAt` is unknown. */
                    purgeAt: z.iso.datetime().nullable(),
                    /** Only set for `teamMembership` rows. */
                    teamId: z.string().optional(),
                    personId: z.string().optional(),
                    /** Only set for `skillGroup`/`skill` rows — their detail pages need the parent package id too. */
                    skillPackageId: z.string().optional(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const roles = await callerRoles(ctx);
            const types = trashableEntityList
                .filter((entity) =>
                    hasAnyRoleWithPermissions(roles, { [entity.permission]: ["delete"] }),
                )
                .map((entity) => entity.id);

            const rows = await Trash.list(ctx, types);
            return rows.map((row) => ({
                ...row,
                deletedAt: row.deletedAt?.toISOString() ?? null,
                purgeAt: row.purgeAt?.toISOString() ?? null,
            }));
        }),

    /**
     * Permanently deletes a record from the Rubbish bin ("Delete forever"), ahead of the daily
     * auto-purge. Same `delete` permission as the soft delete — no separate surface (#258).
     * @throws TRPCError(BAD_REQUEST) if the record isn't `Deleted`, or another organisation's
     *   skill checks hold it back.
     */
    purgeRecord: organizationProcedure()
        .input(trashRecordInput)
        .mutation(async ({ ctx, input: { type, id } }) => {
            await requireDeletePermission(ctx, type);
            await Trash.purge(ctx, type, id);
        }),

    /** Recovers a record from the Rubbish bin back to `Active`, via the entity's own service. */
    recoverRecord: organizationProcedure()
        .input(trashRecordInput)
        .mutation(async ({ ctx, input: { type, id } }) => {
            await requireDeletePermission(ctx, type);
            await Trash.recover(ctx, type, id);
        }),
});
