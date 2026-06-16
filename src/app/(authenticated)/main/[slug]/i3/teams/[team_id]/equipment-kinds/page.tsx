/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/equipment-kinds
 */
"use client";

import { Fragment, use } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";
import { Table, TableBody, TableHeadCell, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

export default function I3Module_Team_EquipmentKindsList_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/equipment-kinds">,
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
        queries: members.map((member) =>
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
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "I3", href: route("/main/[slug]/i3", { slug: organization.slug }) },
                    { label: "Teams" },
                    {
                        label: team.title,
                        href: route("/main/[slug]/i3/teams/[team_id]", {
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
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell></TableHeadCell>
                                <TableHeadCell>Kind</TableHeadCell>
                                <TableHeadCell className="text-center">Issued Count</TableHeadCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usedCategories.map((category) => (
                                <Fragment key={category.id}>
                                    <TableRow>
                                        <TableHeadCell colSpan={2}>{category.title}</TableHeadCell>
                                    </TableRow>
                                    {usedKinds
                                        .filter((kind) => kind.category.id === category.id)
                                        .map((kind) => (
                                            <TableRow key={kind.id}>
                                                <TableHeadCell />
                                                <TableHeadCell>
                                                    <Link
                                                        href={route(
                                                            "/main/[slug]/i3/teams/[team_id]/equipment-kinds/[kind_id]",
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
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
