/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { trpc } from "@/trpc/client";

import { useOrganization } from "./use-organization";
import { OrganizationMembershipData } from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";

export function useOrganizationMembership(
    userId: string,
): OrganizationMembershipData & { user: UserData } {
    const organization = useOrganization();

    const { data: memberships } = useSuspenseQuery(
        trpc.organizations.listOrganizationMembers.queryOptions({
            organizationId: organization.id,
        }),
    );

    const membership = memberships.find((m) => m.userId === userId);

    if (!membership) {
        throw new Error(`Organization membership for User(${userId}) not found`);
    }

    return membership;
}
