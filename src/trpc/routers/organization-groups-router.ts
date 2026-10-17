/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationGroupData,
    OrganizationGroupId,
    OrganizationGroupMembershipId,
    OrganizationGroupRole,
} from "@/lib/schemas/organization-group";
import * as OrganizationGroups from "@/server/services/organization-groups";

import { FieldConflictError } from "../errors";
import { createTrpcRouter, systemAdminProcedure } from "../init";
import { systemServiceContext } from "../system-service-context";

function slugConflictError(slug: string) {
    return new FieldConflictError("slug", `A group with the slug "${slug}" already exists.`);
}

/**
 * Router for organization groups (avut#382): sets of organizations bound together, managed only
 * by system administrators in v1. A thin layer over `OrganizationGroups`; every entry it writes is
 * `scope: "system"`.
 */
export const organizationGroupsRouter = createTrpcRouter({
    /**
     * Add an organization to a group. A previously revoked organization gets its old membership
     * back. `CONFLICT` if it is already an active member, or if `role` is `Overseer` and the group
     * already has an active overseer.
     */
    addMember: systemAdminProcedure
        .input(
            z.object({
                groupId: OrganizationGroupId.schema,
                organizationId: OrganizationId.schema,
                role: OrganizationGroupRole.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return OrganizationGroups.addMember(systemServiceContext(ctx), input);
        }),

    /**
     * Create a group with no members. A taken slug is a `FieldConflictError` on `slug`.
     */
    createGroup: systemAdminProcedure
        .input(OrganizationGroupData.createSchema)
        .mutation(async ({ ctx, input }) => {
            const serviceCtx = systemServiceContext(ctx);
            if (await OrganizationGroups.getGroupBySlug(serviceCtx, input.slug)) {
                throw slugConflictError(input.slug);
            }
            return OrganizationGroups.createGroup(serviceCtx, input);
        }),

    /**
     * Hard-delete a group. `CONFLICT` while any of its memberships is active.
     */
    deleteGroup: systemAdminProcedure
        .input(z.object({ groupId: OrganizationGroupId.schema }))
        .mutation(async ({ ctx, input }) => {
            return OrganizationGroups.deleteGroup(systemServiceContext(ctx), input.groupId);
        }),

    /**
     * A group with every membership it has had (any status).
     */
    getGroup: systemAdminProcedure
        .input(z.object({ groupId: OrganizationGroupId.schema }))
        .query(async ({ ctx, input }) => {
            return OrganizationGroups.getGroupDetail(systemServiceContext(ctx), input.groupId);
        }),

    /**
     * Every group, with its active member count and active overseer.
     */
    listGroups: systemAdminProcedure.query(async ({ ctx }) => {
        return OrganizationGroups.listGroups(systemServiceContext(ctx));
    }),

    /**
     * Every group membership an organization has had (any status).
     */
    listGroupsForOrganization: systemAdminProcedure
        .input(z.object({ organizationId: OrganizationId.schema }))
        .query(async ({ ctx, input }) => {
            return OrganizationGroups.listGroupsForOrganization(
                systemServiceContext(ctx),
                input.organizationId,
            );
        }),

    /**
     * Revoke an active membership. The row is kept so re-adding the organization reactivates it.
     */
    revokeMember: systemAdminProcedure
        .input(z.object({ membershipId: OrganizationGroupMembershipId.schema }))
        .mutation(async ({ ctx, input }) => {
            return OrganizationGroups.revokeMember(systemServiceContext(ctx), input.membershipId);
        }),

    /**
     * Change an active membership's role. `CONFLICT` if the membership isn't active, or if making
     * it `Overseer` would give the group a second active overseer.
     */
    setMemberRole: systemAdminProcedure
        .input(
            z.object({
                membershipId: OrganizationGroupMembershipId.schema,
                role: OrganizationGroupRole.schema,
            }),
        )
        .mutation(async ({ ctx, input }) => {
            return OrganizationGroups.setMemberRole(systemServiceContext(ctx), input);
        }),

    /**
     * Change a group's name and slug. A slug held by another group is a `FieldConflictError` on
     * `slug`; keeping the group's own slug is not a conflict.
     */
    updateGroup: systemAdminProcedure
        .input(OrganizationGroupData.updateSchema)
        .mutation(async ({ ctx, input }) => {
            const serviceCtx = systemServiceContext(ctx);
            const existing = await OrganizationGroups.getGroupBySlug(serviceCtx, input.slug);
            if (existing && existing.id !== input.groupId) {
                throw slugConflictError(input.slug);
            }
            return OrganizationGroups.updateGroup(serviceCtx, input);
        }),
});
