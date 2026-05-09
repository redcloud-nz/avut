/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/equipment-kinds
 */
"use client";

import { Fragment, use } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";
import { Table, TableBody, TableHeadCell, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Route } from "next";

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
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "I3", href: `/main/${organization.slug}/i3` },
                    { label: "Teams" },
                    { label: team.title, href: `/main/${organization.slug}/i3/teams/${teamId}` },
                    { label: "Equipment Kinds" },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Header>
                        <Hermes.Title>Equipment Types issued to {team.title}</Hermes.Title>
                    </Hermes.Header>
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
                                                        href={
                                                            `/main/${organization.slug}/i3/teams/${teamId}/equipment-kinds/${kind.id}` as Route
                                                        }
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
