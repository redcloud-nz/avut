/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ShieldCheckIcon, UserIcon, UserPlusIcon, UsersIcon } from "lucide-react";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Protect } from "@/components/protect";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function Organization_Dashboard_AdminStats() {
    const organization = useOrganization();
    const { slug } = organization;

    const [{ data: personnel }, { data: teams }] = useSuspenseQueries({
        queries: [
            trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }),
            trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
        ],
    });

    const {
        data: { members },
    } = useSuspenseQuery({
        queryKey: ["auth", "organization-users", organization.id],
        queryFn: () =>
            authClient.organization.listMembers(
                { query: { organizationId: organization.id } },
                { throw: true },
            ),
    });

    const activePersonnelCount = personnel.filter((person) => person.status === "Active").length;

    return (
        <StatCardGrid>
            <StatCard
                label="Active Personnel"
                value={activePersonnelCount}
                icon={UsersIcon}
                href={route("/orgs/[slug]/admin/personnel", { slug })}
            />
            <StatCard
                label="Teams"
                value={teams.length}
                icon={ShieldCheckIcon}
                href={route("/orgs/[slug]/admin/teams", { slug })}
            />
            <StatCard
                label="Users"
                value={members.length}
                icon={UserIcon}
                href={route("/orgs/[slug]/admin/users", { slug })}
            />
            <Protect permissions={{ invitation: ["view"] }}>
                <Organization_Dashboard_PendingInvitationsStat />
            </Protect>
        </StatCardGrid>
    );
}

function Organization_Dashboard_PendingInvitationsStat() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: invitations } = useSuspenseQuery({
        queryKey: ["auth", "organization-invitations", organization.id],
        queryFn: () =>
            authClient.organization.listInvitations(
                { query: { organizationId: organization.id } },
                { throw: true },
            ),
    });

    const pendingCount = invitations.filter((invitation) => invitation.status === "pending").length;

    return (
        <StatCard
            label="Pending Invitations"
            value={pendingCount}
            icon={UserPlusIcon}
            href={route("/orgs/[slug]/admin/invitations", { slug })}
        />
    );
}
