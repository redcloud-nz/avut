/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { TrashableEntities, trashableEntityList } from "@/lib/trash-registry";

import { createTrpcRouter, organizationProcedure } from "../init";

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
                    type: z.enum(["Person", "Team"]),
                    name: z.string(),
                    deletedAt: z.iso.datetime().nullable(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            // Read the caller's roles through `ctx.prisma` (rather than the cached
            // `getOrganizationUserRolesOrNull`, which reaches the real Prisma singleton) so this
            // stays testable against the injected mock db like every other procedure.
            const orgUser = await ctx.prisma.organizationUser.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: ctx.organizationId,
                        userId: ctx.userId,
                    },
                },
                select: { role: true },
            });
            const roles = orgUser
                ? z.array(OrganizationRole.schema).parse(orgUser.role.split(","))
                : [];

            const visibleEntities = trashableEntityList.filter((entity) =>
                hasAnyRoleWithPermissions(roles, { [entity.permission]: ["delete"] }),
            );

            const rows: { id: string; type: "Person" | "Team"; name: string }[] = [];

            if (visibleEntities.includes(TrashableEntities.person)) {
                const people = await ctx.prisma.person.findMany({
                    where: { organizationId: ctx.organizationId, status: "Deleted" },
                    select: { id: true, name: true },
                });
                rows.push(
                    ...people.map((p) => ({ id: p.id, type: "Person" as const, name: p.name })),
                );
            }

            if (visibleEntities.includes(TrashableEntities.team)) {
                const teams = await ctx.prisma.team.findMany({
                    where: { organizationId: ctx.organizationId, status: "Deleted" },
                    select: { id: true, name: true },
                });
                rows.push(...teams.map((t) => ({ id: t.id, type: "Team" as const, name: t.name })));
            }

            if (rows.length === 0) return [];

            // Batch-resolve "deleted at" with one query, reduced to the latest Delete entry per
            // (objectType, objectId) — never per row.
            const deleteEntries = await ctx.prisma.logEntry.findMany({
                where: {
                    objectType: { in: [...new Set(rows.map((r) => r.type))] },
                    objectId: { in: rows.map((r) => r.id) },
                    action: "Delete",
                },
                orderBy: { sequence: "desc" },
                select: { objectType: true, objectId: true, timestamp: true },
            });

            const deletedAtByKey = new Map<string, Date>();
            for (const entry of deleteEntries) {
                const key = `${entry.objectType}:${entry.objectId}`;
                if (!deletedAtByKey.has(key)) deletedAtByKey.set(key, entry.timestamp);
            }

            return rows.map((row) => ({
                ...row,
                deletedAt: deletedAtByKey.get(`${row.type}:${row.id}`)?.toISOString() ?? null,
            }));
        }),
});
