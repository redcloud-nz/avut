/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/i3/teams/[team_id]/equipment-kinds/[kind_id]
 */
"use client";

import { use, useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Lexington } from "@/components/blocks/lexington";

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
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export default function I3Module_Team_EquipmentKindItems_Page(
    props: PageProps<"/main/[slug]/i3/teams/[team_id]/equipment-kinds/[kind_id]">,
) {
    const { team_id, kind_id } = use(props.params);
    const kindId = parseInt(kind_id);
    const teamId = parseInt(team_id);

    const organization = useOrganization();

    const [{ data: teams }, { data: kinds }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listAccessibleTeams.queryOptions({
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

    const memberEquipment = useSuspenseQueries({
        queries: members.map((member) =>
            trpc.d4hApi.listMemberEquipment.queryOptions({
                organizationId: organization.id,
                teamId,
                memberId: member.id,
            }),
        ),
        combine: (results) =>
            results
                .map((q, index) => ({
                    member: members[index],
                    items: (q.data ?? []).filter((item) => item.kind.id === kindId),
                }))
                .sort((a, b) => a.member.name.localeCompare(b.member.name)),
    });

    const team = teams.find((t) => t.id === teamId);
    if (!team) throw new Error(`D4HTeam(${teamId}) not found`);

    const kind = kinds.find((k) => k.id === kindId);
    if (!kind) throw new Error(`D4HEquipmentKind(${kindId}) not found`);

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
                    { label: "I3", href: route("/main/[slug]/i3", { slug: organization.slug }) },
                    { label: "Teams" },
                    {
                        label: team.title,
                        href: route("/main/[slug]/i3/teams/[team_id]", {
                            slug: organization.slug,
                            team_id,
                        }),
                    },
                    {
                        label: "Equipment Types",
                        href: route("/main/[slug]/i3/teams/[team_id]/equipment-kinds", {
                            slug: organization.slug,
                            team_id,
                        }),
                    },
                    { label: kind.title },
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="full">
                    <Hermes.Header>
                        <Hermes.Title>{kind.title}</Hermes.Title>
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
                                <TableHeadCell>Member</TableHeadCell>
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
                            {memberEquipment.map(({ member, items }) =>
                                items.map((item, index) => (
                                    <TableRow key={item.id}>
                                        {index === 0 && (
                                            <TableCell rowSpan={items.length}>
                                                {member.name}
                                            </TableCell>
                                        )}
                                        <TableCell>{item.ref}</TableCell>
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
                                )),
                            )}
                        </TableBody>
                    </Table>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
