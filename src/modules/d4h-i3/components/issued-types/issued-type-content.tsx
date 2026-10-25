/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { notFound } from "next/navigation";
import { useState, type ReactNode } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HEquipmentBrandLink } from "@/components/entity-links/d4h-equipment-brand-link";
import { D4HEquipmentItemLink } from "@/components/entity-links/d4h-equipment-item-link";
import { D4HEquipmentModelLink } from "@/components/entity-links/d4h-equipment-model-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { D4HMemberLink } from "@/components/entity-links/d4h-member-link";
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
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { D4HI3Module_ReturnedBadge } from "@/modules/d4h-i3/components/returned-badge";
import { trpc, type RouterOutput } from "@/trpc/client";

/** The optional columns, in the order the Show Columns menu lists them. */
const OPTIONAL_COLUMNS = [
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "serial", label: "Serial Number" },
    { key: "expiry", label: "Expiry Date" },
    { key: "notes", label: "Notes" },
    { key: "status", label: "D4H Status" },
] as const;

type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["key"];

type IssuedItem = RouterOutput["d4hApi"]["listTeamIssuedEquipment"][number];

function optionalCell(
    item: IssuedItem,
    column: OptionalColumn,
    formatDate: (date: string) => string,
): ReactNode {
    switch (column) {
        case "brand": {
            const { brand } = item;
            if (brand.id == null || !brand.title) return brand.title || "—";
            return <D4HEquipmentBrandLink brand={{ id: brand.id, title: brand.title }} />;
        }
        case "model": {
            const { brand, model } = item;
            if (model?.id == null || !model.title || brand.id == null) return model?.title || "—";
            return (
                <D4HEquipmentModelLink
                    model={{ id: model.id, title: model.title, brand: { id: brand.id } }}
                />
            );
        }
        case "serial":
            return item.serial;
        case "expiry":
            return item.dateExpires ? formatDate(item.dateExpires) : null;
        case "notes":
            return item.notes;
        case "status":
            return D4HEquipmentStatus.label(item.status);
    }
}

/**
 * The items of one equipment type issued to one D4H team's members, one row per item sorted by
 * holder, with a Returned badge on items waiting for their Retire task to be applied.
 */
export function D4HI3Module_IssuedType_Content({
    teamId,
    typeId,
}: {
    teamId: number;
    typeId: number;
}) {
    const organization = useOrganization();
    const { slug } = organization;
    const { formatDate } = usePreferences();

    const [showColumns, setShowColumns] = useState<Record<OptionalColumn, boolean>>({
        brand: true,
        model: true,
        serial: false,
        expiry: false,
        notes: false,
        status: true,
    });

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );
    const { data: kinds } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
    );

    // Check the team and type before reading the items, so either unknown shows the not-found panel.
    const team = teams.find((t) => t.id === teamId);
    const kind = kinds.find((k) => k.id === typeId);
    if (!team || !kind) notFound();

    const { data: items } = useSuspenseQuery(
        trpc.d4hApi.listTeamIssuedEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );
    const { data: returnedItemIds } = useSuspenseQuery(
        trpc.d4hTasks.listReturnedItemIds.queryOptions({ organizationId: organization.id, teamId }),
    );
    const returnedIds = new Set(returnedItemIds);

    const rows = R.pipe(
        items.filter((item) => item.kind.id === typeId),
        R.map((item) => ({ item, holderName: item.holder.name ?? `Member #${item.holder.id}` })),
        R.sortBy(
            (row) => row.holderName,
            (row) => row.item.ref,
        ),
    );

    const visibleColumns = OPTIONAL_COLUMNS.filter((column) => showColumns[column.key]);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    {
                        label: "Issued Types",
                        href: route("/orgs/[slug]/d4h-i3/issued-types", { slug }),
                    },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types", {
                            slug,
                            d4h_team_id: String(teamId),
                        }),
                    },
                    { label: kind.title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{kind.title}</Saratoga.Title>
                        <Saratoga.Actions>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Actions">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent size="sm" align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Show Columns</DropdownMenuLabel>
                                        {OPTIONAL_COLUMNS.map((column) => (
                                            <DropdownMenuCheckboxItem
                                                key={column.key}
                                                checked={showColumns[column.key]}
                                                onCheckedChange={(checked) =>
                                                    setShowColumns((prev) => ({
                                                        ...prev,
                                                        [column.key]: checked,
                                                    }))
                                                }
                                            >
                                                {column.label}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <p className="text-muted-foreground text-sm">
                        D4H Type: <D4HEquipmentTypeLink type={kind} />
                    </p>
                    {rows.length === 0 ? (
                        <Empty>
                            <EmptyDescription>
                                No {kind.title} is issued to members of {team.title}.
                            </EmptyDescription>
                        </Empty>
                    ) : (
                        <TablePanel>
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHeadCell>Ref</TableHeadCell>
                                        <TableHeadCell>Issued To</TableHeadCell>
                                        {visibleColumns.map((column) => (
                                            <TableHeadCell
                                                key={column.key}
                                                className="hidden lg:table-cell"
                                            >
                                                {column.label}
                                            </TableHeadCell>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map(({ item }) => (
                                        <TableRow key={item.id}>
                                            <TableCell>
                                                <D4HEquipmentItemLink item={item} />
                                                {returnedIds.has(item.id) && (
                                                    <>
                                                        {" "}
                                                        <D4HI3Module_ReturnedBadge />
                                                    </>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <D4HMemberLink
                                                    member={{
                                                        ...item.holder,
                                                        owner: { id: teamId },
                                                    }}
                                                />
                                            </TableCell>
                                            {visibleColumns.map((column) => (
                                                <TableCell
                                                    key={column.key}
                                                    className="hidden lg:table-cell"
                                                >
                                                    {optionalCell(item, column.key, formatDate)}
                                                </TableCell>
                                            ))}
                                        </TableRow>
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
