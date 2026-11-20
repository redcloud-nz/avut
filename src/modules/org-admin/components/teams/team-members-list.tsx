/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useCallback } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ItemLinkActionIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Teams_AddTeamMembership_Dialog } from "@/components/teams/add-team-membership";
import {
    Teams_Members_Table,
    type Teams_MembershipRow,
} from "@/components/teams/team-members-table";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_TeamMembers_List({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-membership"] as const),
    );

    const [{ data: team }, { data: teamMembers }] = useSuspenseQueries({
        queries: [
            trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        ],
    });

    const rowAction = useCallback(
        (row: Teams_MembershipRow) => (
            <Link
                href={route("/orgs/[slug]/admin/teams/[team_id]/members/[person_id]", {
                    slug: organization.slug,
                    team_id: teamId,
                    person_id: row.person.id,
                })}
                aria-label="View membership"
                className="text-muted-foreground hover:text-foreground flex justify-center"
            >
                <ItemLinkActionIcon className="size-4" />
            </Link>
        ),
        [organization.slug, teamId],
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Teams",
                        href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }),
                    },
                    {
                        label: team.name,
                        href: route("/orgs/[slug]/admin/teams/[team_id]", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
                    },
                    "Members",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members of {team.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            {team.status === "Active" && (
                                <Protect permissions={{ team: ["update"] }}>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setAction("add-membership", { history: "push" })
                                        }
                                    >
                                        <ObjectIcons.Create />{" "}
                                        <span className="sr-only md:not-sr-only">New Member</span>
                                    </Button>
                                </Protect>
                            )}
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Teams_Members_Table
                        team={team}
                        memberships={teamMembers}
                        rowAction={rowAction}
                    />
                </Saratoga.Root>
            </Std.ScrollContainer>

            <Teams_AddTeamMembership_Dialog
                team={team}
                open={action === "add-membership"}
                onOpenChange={(open) =>
                    setAction(open ? "add-membership" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
