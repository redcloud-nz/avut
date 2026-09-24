/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ShieldCheckIcon, UserIcon, UserPlusIcon, UsersIcon } from "lucide-react";
import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Protect } from "@/components/protect";
import { StatCard, StatCardGrid, StatCardSkeleton } from "@/components/ui/stat-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function Organization_Dashboard_AdminStats() {
    return (
        <StatCardGrid>
            <Protect permissions={{ person: ["view"] }}>
                <Suspense fallback={<StatCardSkeleton />}>
                    <Organization_Dashboard_ActivePersonnelStat />
                </Suspense>
            </Protect>
            <Protect permissions={{ team: ["view"] }}>
                <Suspense fallback={<StatCardSkeleton />}>
                    <Organization_Dashboard_TeamsStat />
                </Suspense>
            </Protect>
            <Protect permissions={{ member: ["view"] }}>
                <Suspense fallback={<StatCardSkeleton />}>
                    <Organization_Dashboard_UsersStat />
                </Suspense>
            </Protect>
            <Protect permissions={{ invitation: ["view"] }}>
                <Suspense fallback={<StatCardSkeleton />}>
                    <Organization_Dashboard_PendingInvitationsStat />
                </Suspense>
            </Protect>
        </StatCardGrid>
    );
}

function Organization_Dashboard_ActivePersonnelStat() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: personnel } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({ organizationId: organization.id }),
    );

    const activePersonnelCount = personnel.filter((person) => person.status === "Active").length;

    return (
        <StatCard
            label="Active Personnel"
            value={activePersonnelCount}
            icon={UsersIcon}
            href={route("/orgs/[slug]/admin/personnel", { slug })}
        />
    );
}

function Organization_Dashboard_TeamsStat() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );
    const activeTeamCount = teams.filter((team) => team.status === "Active").length;

    return (
        <StatCard
            label="Teams"
            value={activeTeamCount}
            icon={ShieldCheckIcon}
            href={route("/orgs/[slug]/admin/teams", { slug })}
        />
    );
}

function Organization_Dashboard_UsersStat() {
    const organization = useOrganization();
    const { slug } = organization;

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

    return (
        <StatCard
            label="Users"
            value={members.length}
            icon={UserIcon}
            href={route("/orgs/[slug]/admin/users", { slug })}
        />
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
