/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { D4HModule_TeamPickerDialog } from "../teams/team-picker-dialog";

/**
 * The `/d4h/members` landing page. Members are listed per team, so it goes straight to the only
 * team's members when there's one, and otherwise opens the team picker. Without a D4H token the
 * query fails and the error boundary explains.
 */
export function D4HModule_Members_SelectTeam() {
    const organization = useOrganization();
    const { slug } = organization;
    const router = useRouter();

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const membersOf = (teamId: number) =>
        route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members", {
            slug,
            d4h_team_id: String(teamId),
        });

    const onlyTeamHref = teams.length === 1 ? membersOf(teams[0].id) : null;

    useEffect(() => {
        if (onlyTeamHref !== null) router.replace(onlyTeamHref);
    }, [onlyTeamHref, router]);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Members" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members</Saratoga.Title>
                        {teams.length > 1 && (
                            <Saratoga.Actions>
                                <D4HModule_TeamPickerDialog
                                    forceOpen
                                    label="Select a team"
                                    section={membersOf}
                                />
                            </Saratoga.Actions>
                        )}
                    </Saratoga.Header>
                    {teams.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No D4H teams</EmptyTitle>
                                <EmptyDescription>
                                    Your D4H access token doesn&apos;t reach any teams, so there are
                                    no members to show.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : teams.length > 1 ? (
                        <Empty>
                            <EmptyDescription>
                                D4H members are listed per team. Select a team to see its members.
                            </EmptyDescription>
                        </Empty>
                    ) : null}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
