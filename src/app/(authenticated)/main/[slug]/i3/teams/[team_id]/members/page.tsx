/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/members
 */
"use client";

import { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
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

export default function I3Module_MembersList_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/members">,
) {
    const { team_id } = use(props.params);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const t = useTranslations("I3Module");

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
                    {
                        label: t("title"),
                        href: `/main/${organization.slug}/i3`,
                    },
                    {
                        label: "Teams",
                    },
                    {
                        label: team.title,
                    },
                    {
                        label: t("members"),
                        href: `/main/${organization.slug}/i3/by-member`,
                    },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="md">
                    <Hermes.Header>
                        <Hermes.Title>
                            {t("TeamMembersList.title", { teamName: team.title })}
                        </Hermes.Title>
                        <Hermes.Description>{t("TeamMembersList.description")}</Hermes.Description>
                    </Hermes.Header>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell>Name</TableHeadCell>
                                <TableHeadCell className="text-center">Items Issued</TableHeadCell>
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
                                        {memberEquipmentQueries[index].data?.length ?? 0}
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
