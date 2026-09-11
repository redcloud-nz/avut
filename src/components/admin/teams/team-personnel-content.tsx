/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_AddTeamMember_Dialog } from "./add-team-member";
import { AdminModule_RemoveTeamMember_Dialog } from "./remove-team-member";

export function AdminModule_Team_Personnel_Content({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();

    const [{ data: team }, { data: teamMembers }] = useSuspenseQueries({
        queries: [
            trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        ],
    });

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["remove-member"] as const),
    );
    const [memberId, setMemberId] = useQueryState("memberId", parseAsString);

    const activeMember = teamMembers.find((tm) => tm.personId === memberId) ?? null;

    function openRemoveMember(id: string) {
        void setMemberId(id, { history: "push" });
        void setAction("remove-member", { history: "push" });
    }

    function closeRemoveMember() {
        void setAction(null, { history: "replace" });
        void setMemberId(null, { history: "replace" });
    }

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
                    "Personnel",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members of {team.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ team: ["update"] }}>
                                <AdminModule_AddTeamMember_Dialog team={team} />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeadCell>Name</TableHeadCell>
                                    <TableCell className="w-9"></TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teamMembers
                                    .sort((a, b) => a.person.name.localeCompare(b.person.name))
                                    .map(({ person, ...teamMembership }) => (
                                        <TableRow key={teamMembership.personId}>
                                            <TableCell>{person.name}</TableCell>
                                            <TableCell className="w-9 p-0">
                                                <Protect permissions={{ team: ["update"] }}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() =>
                                                            openRemoveMember(
                                                                teamMembership.personId,
                                                            )
                                                        }
                                                    >
                                                        <ObjectIcons.Delete />
                                                    </Button>
                                                </Protect>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>

                        {activeMember && (
                            <AdminModule_RemoveTeamMember_Dialog
                                organizationId={organization.id}
                                team={team}
                                person={activeMember.person}
                                open={action === "remove-member"}
                                onOpenChange={(open) => (open ? undefined : closeRemoveMember())}
                            />
                        )}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
