/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/members
 */
"use client";

import { Route } from "next";
import Link from "next/link";
import { use } from "react";

import { useQueries, useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";
import { Spinner } from "@/components/ui/spinner";

export default function I3Module_MembersList_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/members">,
) {
    const { team_id } = use(props.params);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const [{ data: teams }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listAccessibleTeams.queryOptions({
                organizationId: organization.id,
                module: "i3",
                action: "read",
            }),
            trpc.d4hApi.listMembers.queryOptions({
                organizationId: organization.id,
                module: "i3",
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
                module: "i3",
                teamId,
                memberId: member.id,
            }),
        ),
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "I3", href: `/main/${organization.slug}/i3` },
                    { label: "Teams" },
                    { label: team.title, href: `/main/${organization.slug}/i3/teams/${teamId}` },
                    {
                        label: "Members",
                        href: `/main/${organization.slug}/i3/teams/${teamId}/members`,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Header>
                        <Hermes.Title>Members of {team.title}</Hermes.Title>
                        <Hermes.Description>
                            Select a team member to view their issued items.
                        </Hermes.Description>
                    </Hermes.Header>
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
                                            href={
                                                `/main/${organization.slug}/i3/teams/${teamId}/members/${member.id}` as Route
                                            }
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
