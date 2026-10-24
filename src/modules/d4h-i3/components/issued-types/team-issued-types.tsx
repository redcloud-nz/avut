/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HTeamPickerDialog } from "@/components/d4h/team-picker-dialog";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TablePanel,
    TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

/**
 * The equipment types issued to one D4H team's members, grouped by category, with how many of
 * each are issued. Change team shows another team's.
 */
export function D4HI3Module_TeamIssuedTypes({ teamId }: { teamId: number }) {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    // Check the team before reading its items, so an unknown team shows the not-found panel.
    const team = teams.find((t) => t.id === teamId);
    if (!team) notFound();

    const { data: categories } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
    );
    const { data: items } = useSuspenseQuery(
        trpc.d4hApi.listTeamIssuedEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );

    const groups = R.pipe(
        items,
        R.groupBy((item) => item.category.id),
        R.entries(),
        R.map(([categoryId, categoryItems]) => ({
            id: Number(categoryId),
            title:
                categories.find((category) => category.id === Number(categoryId))?.title ??
                `Category #${categoryId}`,
            types: R.pipe(
                categoryItems,
                R.groupBy((item) => item.kind.id),
                R.values(),
                R.map((typeItems) => ({
                    id: typeItems[0].kind.id,
                    title: typeItems[0].kind.title,
                    count: typeItems.length,
                })),
                R.sortBy((type) => type.title),
            ),
        })),
        R.sortBy((group) => group.title),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    {
                        label: "Issued Types",
                        href: route("/orgs/[slug]/d4h-i3/issued-types", { slug }),
                    },
                    { label: team.title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Equipment Types issued to {team.title}</Saratoga.Title>
                        {teams.length > 1 && (
                            <Saratoga.Actions>
                                <D4HTeamPickerDialog
                                    section={(id) =>
                                        route(
                                            "/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types",
                                            { slug, d4h_team_id: String(id) },
                                        )
                                    }
                                />
                            </Saratoga.Actions>
                        )}
                    </Saratoga.Header>
                    {groups.length === 0 ? (
                        <Empty>
                            <EmptyDescription>
                                No equipment is issued to members of {team.title}.
                            </EmptyDescription>
                        </Empty>
                    ) : (
                        <TablePanel>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHeadCell>Type</TableHeadCell>
                                        <TableHeadCell className="w-32 text-center">
                                            Issued Count
                                        </TableHeadCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groups.map((group) => (
                                        <Fragment key={group.id}>
                                            <TableRow className="bg-table-group hover:bg-table-group">
                                                <TableHeadCell colSpan={2}>
                                                    {group.title}
                                                </TableHeadCell>
                                            </TableRow>
                                            {group.types.map((type) => (
                                                <TableRow key={type.id}>
                                                    <TableCell className="pl-6">
                                                        <Link
                                                            href={route(
                                                                "/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types/[type_id]",
                                                                {
                                                                    slug,
                                                                    d4h_team_id: String(teamId),
                                                                    type_id: String(type.id),
                                                                },
                                                            )}
                                                        >
                                                            {type.title}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {type.count}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </TablePanel>
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
