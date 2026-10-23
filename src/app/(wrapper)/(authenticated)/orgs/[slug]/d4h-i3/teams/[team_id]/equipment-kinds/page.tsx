/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/teams/[team_id]/equipment-kinds
 */
"use client";

import Link from "next/link";
import { Fragment, use } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import {
    Table,
    TableBody,
    TableHeadCell,
    TableHeader,
    TablePanel,
    TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export default function D4HI3Module_Team_EquipmentKindsList_Page(
    props: PageProps<"/orgs/[slug]/d4h-i3/teams/[team_id]/equipment-kinds">,
) {
    const { team_id } = use(props.params);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const [{ data: teams }, { data: categories }, { data: kinds }, { data: members }] =
        useSuspenseQueries({
            queries: [
                trpc.d4hApi.listAccessibleTeams.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.d4hApi.listEquipmentCategories.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.d4hApi.listEquipmentKinds.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.d4hApi.listMembers.queryOptions({
                    organizationId: organization.id,
                }),
            ],
        });

    const memberEquipmentQueries = useSuspenseQueries({
        queries: members
            .filter((member) => member.owner.id === teamId)
            .map((member) =>
                trpc.d4hApi.listMemberEquipment.queryOptions({
                    organizationId: organization.id,
                    teamId,
                    memberId: member.id,
                }),
            ),
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    const memberEquipment = memberEquipmentQueries.flatMap((q) => q.data ?? []);

    const usedCategories = categories.filter((cat) =>
        memberEquipment.some((eq) => eq.category.id === cat.id),
    );
    const usedKinds = kinds.filter((kind) => memberEquipment.some((eq) => eq.kind.id === kind.id));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H I3",
                        href: route("/orgs/[slug]/d4h-i3", { slug: organization.slug }),
                    },
                    { label: "Teams" },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/d4h-i3/teams/[team_id]", {
                            slug: organization.slug,
                            team_id,
                        }),
                    },
                    { label: "Equipment Kinds" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Equipment Types issued to {team.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <TablePanel>
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHeadCell></TableHeadCell>
                                    <TableHeadCell>Kind</TableHeadCell>
                                    <TableHeadCell className="text-center">
                                        Issued Count
                                    </TableHeadCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usedCategories.map((category) => (
                                    <Fragment key={category.id}>
                                        <TableRow className="bg-table-group hover:bg-table-group">
                                            <TableHeadCell colSpan={3}>
                                                {category.title}
                                            </TableHeadCell>
                                        </TableRow>
                                        {usedKinds
                                            .filter((kind) => kind.category.id === category.id)
                                            .map((kind) => (
                                                <TableRow key={kind.id}>
                                                    <TableHeadCell />
                                                    <TableHeadCell>
                                                        <Link
                                                            href={route(
                                                                "/orgs/[slug]/d4h-i3/teams/[team_id]/equipment-kinds/[kind_id]",
                                                                {
                                                                    slug: organization.slug,
                                                                    team_id,
                                                                    kind_id: String(kind.id),
                                                                },
                                                            )}
                                                        >
                                                            {kind.title}
                                                        </Link>
                                                    </TableHeadCell>
                                                    <TableHeadCell className="text-center">
                                                        {
                                                            memberEquipment.filter(
                                                                (eq) => eq.kind.id === kind.id,
                                                            ).length
                                                        }
                                                    </TableHeadCell>
                                                </TableRow>
                                            ))}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TablePanel>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
