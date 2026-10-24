/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HTeamPickerDialog } from "@/components/d4h/team-picker-dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

/**
 * The `/d4h-i3/issued-types` landing page for zero or several teams: an empty state, or the team
 * picker. With one team, `page.tsx` redirects to its issued types before this renders. Without a
 * D4H token the query fails and the error boundary explains.
 */
export function D4HI3Module_IssuedTypes_SelectTeam() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const issuedTypesOf = (teamId: number) =>
        route("/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types", {
            slug,
            d4h_team_id: String(teamId),
        });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "Issued Types" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Issued Types</Saratoga.Title>
                        {teams.length > 1 && (
                            <Saratoga.Actions>
                                <D4HTeamPickerDialog
                                    forceOpen
                                    label="Select a team"
                                    section={issuedTypesOf}
                                />
                            </Saratoga.Actions>
                        )}
                    </Saratoga.Header>
                    {teams.length === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No D4H teams</EmptyTitle>
                                <EmptyDescription>
                                    Your D4H access token doesn&apos;t reach any teams, so there is
                                    no issued equipment to show.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : teams.length > 1 ? (
                        <Empty>
                            <EmptyDescription>
                                Issued equipment is listed per team. Select a team to see the
                                equipment types issued to its members.
                            </EmptyDescription>
                        </Empty>
                    ) : null}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
