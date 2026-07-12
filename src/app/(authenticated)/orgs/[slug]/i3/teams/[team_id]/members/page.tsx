/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3/teams/[team_id]/members
 */
"use client";

import Link from "next/link";
import { use } from "react";

import { useQueries, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
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
import { trpc } from "@/trpc/client";
import { Spinner } from "@/components/ui/spinner";

export default function I3Module_MembersList_Page(
    props: PageProps<"/orgs/[slug]/i3/teams/[team_id]/members">,
) {
    const { team_id } = use(props.params);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const [{ data: teams }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listAccessibleTeams.queryOptions({
                organizationId: organization.id,
            }),
            trpc.d4hApi.listMembers.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const filteredMembers = members
        .filter((member) => member.owner.id === teamId)
        .sort((a, b) => a.name.localeCompare(b.name));

    const memberEquipmentQueries = useQueries({
        queries: filteredMembers.map((member) =>
            trpc.d4hApi.listMemberEquipment.queryOptions({
                organizationId: organization.id,
                teamId,
                memberId: member.id,
            }),
        ),
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "I3", href: route("/orgs/[slug]/i3", { slug: organization.slug }) },
                    { label: "Teams" },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/i3/teams/[team_id]", {
                            slug: organization.slug,
                            team_id,
                        }),
                    },
                    {
                        label: "Members",
                        href: route("/orgs/[slug]/i3/teams/[team_id]/members", {
                            slug: organization.slug,
                            team_id,
                        }),
                    },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members of {team.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <p className="text-sm text-muted-foreground">
                        Select a team member to view their issued items.
                    </p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell className="text-center">Issued Items</TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMembers.map((member, index) => (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <Link
                                            href={route(
                                                "/orgs/[slug]/i3/teams/[team_id]/members/[member_id]",
                                                {
                                                    slug: organization.slug,
                                                    team_id,
                                                    member_id: String(member.id),
                                                },
                                            )}
                                        >
                                            {member.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {memberEquipmentQueries[index].data?.length ?? (
                                            <Spinner className="size-3 inline-block" />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
