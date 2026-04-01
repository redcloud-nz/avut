/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/members/[member_id]
 */
"use client";

import { Route } from "next";
import Link from "next/link";
import { Fragment, use, useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

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
import { ArrowLeftIcon } from "lucide-react";

export default function I3Module_Member_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/members/[member_id]">,
) {
    const { member_id, team_id } = use(props.params);
    const memberId = parseInt(member_id);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const [{ data: categories }, { data: members }, { data: memberEquipment }, { data: teams }] =
        useSuspenseQueries({
            queries: [
                trpc.d4hApi.listEquipmentCategories.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                }),
                trpc.d4hApi.listMembers.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                }),
                trpc.d4hApi.listMemberEquipment.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                    memberId,
                    teamId,
                }),
                trpc.d4hApi.listAccessibleTeams.queryOptions({
                    organizationId: organization.id,
                    module: "i3",
                    action: "read",
                }),
            ],
        });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    const member = members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member with id ${memberId} not found`);

    const itemsByCategory = categories
        .map((category) => {
            return {
                category,
                items: memberEquipment
                    .filter((item) => item.category.id === category.id)
                    .sort((a, b) => a.kind.title.localeCompare(b.kind.title)),
            };
        })
        .filter((category) => category.items.length > 0);

    const [showColumns, setShowColumns] = useState({
        brand: true,
        expiry: false,
        model: true,
        serial: false,
        status: true,
    });

    return (
        <Lexington.Root>
            <Lexington.Header>
                <Lexington.Title>{`Issued to ${member.name}`}</Lexington.Title>
                <Lexington.Actions>
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
                </Lexington.Actions>
            </Lexington.Header>
            <Lexington.Page>
                <Lexington.Column width="full">
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
                            {itemsByCategory.map(({ category, items }) => (
                                <Fragment key={category.id}>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-semibold">
                                            {category.title}
                                        </TableCell>
                                    </TableRow>
                                    {items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell></TableCell>
                                            <TableCell>{item.kind.title}</TableCell>
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
                        </TableBody>
                    </Table>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
