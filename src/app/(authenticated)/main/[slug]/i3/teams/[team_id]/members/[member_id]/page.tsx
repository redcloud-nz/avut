/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/members/[member_id]
 */
"use client";

import { Fragment, use, useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { trpc } from "@/trpc/client";

export default function I3Module_Team_MemberItems_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/members/[member_id]">,
) {
    const { member_id, team_id } = use(props.params);
    const memberId = parseInt(member_id);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const [
        { data: teams },
        { data: categories },
        { data: kinds },
        { data: members },
        { data: memberEquipment },
    ] = useSuspenseQueries({
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
            trpc.d4hApi.listMemberEquipment.queryOptions({
                organizationId: organization.id,
                memberId,
                teamId,
            }),
        ],
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    const member = members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member with id ${memberId} not found`);

    const kindsWithItems = kinds
        .map((kind) => {
            return {
                kind,
                items: memberEquipment
                    .filter((item) => item.kind.id === kind.id)
                    .sort((a, b) => a.ref.localeCompare(b.ref)),
            };
        })
        .filter(({ items }) => items.length > 0);

    const categoriesWithKindsAndItems = categories
        .map((category) => {
            return {
                category,
                kinds: kindsWithItems.filter(({ kind }) => kind.category.id === category.id),
            };
        })
        .filter(({ kinds }) => kinds.length > 0);

    const [showColumns, setShowColumns] = useState({
        brand: true,
        expiry: false,
        model: true,
        notes: false,
        serial: false,
        status: true,
    });

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
                    { label: member.name },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Header>
                        <Hermes.Title>Items issued to {member.name}</Hermes.Title>
                        <Hermes.Action>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Show Columns</DropdownMenuLabel>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.brand}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    brand: checked,
                                                }))
                                            }
                                        >
                                            Brand
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.expiry}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    expiry: checked,
                                                }))
                                            }
                                        >
                                            Expiry Date
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.model}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    model: checked,
                                                }))
                                            }
                                        >
                                            Model
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.notes}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    notes: checked,
                                                }))
                                            }
                                        >
                                            Notes
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.serial}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    serial: checked,
                                                }))
                                            }
                                        >
                                            Serial Number
                                        </DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem
                                            checked={showColumns.status}
                                            onCheckedChange={(checked) =>
                                                setShowColumns((prev) => ({
                                                    ...prev,
                                                    status: checked,
                                                }))
                                            }
                                        >
                                            Status
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Hermes.Action>
                    </Hermes.Header>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHeadCell></TableHeadCell>
                                <TableHeadCell>Kind</TableHeadCell>
                                <TableHeadCell>Ref</TableHeadCell>
                                {showColumns.brand && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Brand
                                    </TableHeadCell>
                                )}
                                {showColumns.model && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Model
                                    </TableHeadCell>
                                )}
                                {showColumns.notes && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Notes
                                    </TableHeadCell>
                                )}
                                {showColumns.serial && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Serial Number
                                    </TableHeadCell>
                                )}
                                {showColumns.expiry && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Expiry Date
                                    </TableHeadCell>
                                )}
                                {showColumns.status && (
                                    <TableHeadCell className="hidden lg:table-cell">
                                        Status
                                    </TableHeadCell>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categoriesWithKindsAndItems.map(({ category, kinds }) => (
                                <Fragment key={category.id}>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-semibold">
                                            {category.title}
                                        </TableCell>
                                    </TableRow>
                                    {kinds.map(({ kind, items }) => (
                                        <Fragment key={kind.id}>
                                            {items.map((item, itemIndex) => (
                                                <TableRow key={item.id}>
                                                    {itemIndex == 0 ? (
                                                        <>
                                                            <TableCell
                                                                rowSpan={items.length}
                                                            ></TableCell>
                                                            <TableCell rowSpan={items.length}>
                                                                {item.kind.title}
                                                            </TableCell>
                                                        </>
                                                    ) : null}
                                                    <TableCell>#{item.ref}</TableCell>
                                                    {showColumns.brand && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.brand?.title}
                                                        </TableCell>
                                                    )}
                                                    {showColumns.model && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.model?.title}
                                                        </TableCell>
                                                    )}
                                                    {showColumns.notes && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.notes}
                                                        </TableCell>
                                                    )}
                                                    {showColumns.serial && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.serial}
                                                        </TableCell>
                                                    )}
                                                    {showColumns.expiry && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.dateExpires
                                                                ? formatDate(item.dateExpires)
                                                                : ""}
                                                        </TableCell>
                                                    )}
                                                    {showColumns.status && (
                                                        <TableCell className="hidden lg:table-cell">
                                                            {item.status}
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            ))}
                                        </Fragment>
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
