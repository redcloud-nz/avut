/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { notFound } from "next/navigation";
import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { D4HItemRef } from "@/components/d4h/d4h-item-ref";
import { D4HEquipmentBrandLink } from "@/components/entity-links/d4h-equipment-brand-link";
import { D4HEquipmentItemLink } from "@/components/entity-links/d4h-equipment-item-link";
import { D4HEquipmentModelLink } from "@/components/entity-links/d4h-equipment-model-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentItem, D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { trpc } from "@/trpc/client";

/** A D4H member of one team: their details and the equipment they hold. */
export function D4HModule_Member_Content({
    teamId,
    memberId,
}: {
    teamId: number;
    memberId: number;
}) {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    // Check the team before reading its members, so an unknown team shows the not-found panel.
    const team = teams.find((t) => t.id === teamId);
    if (!team) notFound();

    const { data: members } = useSuspenseQuery(
        trpc.d4hApi.listTeamMembers.queryOptions({ organizationId: organization.id, teamId }),
    );

    // `listTeamMembers` returns only Operational and Non-operational members, so anyone else is
    // not found here.
    const member = members.find((m) => m.id === memberId);
    if (!member) notFound();

    const { data: items } = useSuspenseQuery(
        trpc.d4hApi.listMemberEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
            memberId,
        }),
    );

    const columns = useMemo(() => {
        // Catalogue and item pages live under the owning team, so a row whose team is out of
        // reach renders plain text throughout.
        const reachableTeamIds = new Set(teams.map((t) => t.id));
        const isReachable = (item: { owner: { id: number } }) =>
            reachableTeamIds.has(item.owner.id);

        return Kaga.defineColumns<D4HEquipmentItem>((columnHelper) => [
            columnHelper.accessor("ref", {
                header: "Ref",
                // An item held by this member can belong to another team. Its page lives under
                // that team, so link there, and not at all when that team is out of reach.
                cell: (ctx) => {
                    const item = ctx.row.original;
                    if (!isReachable(item)) return <D4HItemRef value={item.ref} />;
                    return <D4HEquipmentItemLink item={item} />;
                },
                enableGlobalFilter: true,
                enableSorting: true,
                enableColumnFilter: false,
            }),
            columnHelper.accessor("kind.title", {
                header: "Type",
                cell: (ctx) => {
                    const item = ctx.row.original;
                    if (!isReachable(item)) return item.kind.title;
                    return <D4HEquipmentTypeLink type={item.kind} />;
                },
                enableGlobalFilter: true,
                enableSorting: true,
                enableColumnFilter: false,
            }),
            columnHelper.accessor((item) => item.brand.title ?? "", {
                id: "brand",
                header: "Brand",
                cell: (ctx) => {
                    const item = ctx.row.original;
                    const { brand } = item;
                    if (brand.id == null || !brand.title || !isReachable(item)) {
                        return ctx.getValue() || "—";
                    }
                    return <D4HEquipmentBrandLink brand={{ id: brand.id, title: brand.title }} />;
                },
                enableGlobalFilter: true,
                enableSorting: true,
                enableColumnFilter: false,
            }),
            columnHelper.accessor((item) => item.model?.title ?? "", {
                id: "model",
                header: "Model",
                cell: (ctx) => {
                    const item = ctx.row.original;
                    const { brand, model } = item;
                    if (
                        model?.id == null ||
                        !model.title ||
                        brand.id == null ||
                        !isReachable(item)
                    ) {
                        return ctx.getValue() || "—";
                    }
                    return (
                        <D4HEquipmentModelLink
                            model={{
                                id: model.id,
                                title: model.title,
                                brand: { id: brand.id },
                            }}
                        />
                    );
                },
                enableGlobalFilter: true,
                enableSorting: true,
                enableColumnFilter: false,
            }),
            columnHelper.accessor("status", {
                header: "D4H Status",
                cell: (ctx) => D4HEquipmentStatus.label(ctx.getValue()),
                filterFn: Kaga.filterFns.oneOf,
                enableColumnFilter: true,
                enableSorting: false,
                enableGlobalFilter: false,
                meta: {
                    // `listMemberEquipment` asks for current items only, so no wishlist.
                    columnOptions: D4HEquipmentStatus.schema.options
                        .filter((value) => value !== "WISHLIST")
                        .map((value) => ({ value, label: D4HEquipmentStatus.label(value) })),
                },
            }),
        ]);
    }, [teams]);

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Teams", href: route("/orgs/[slug]/d4h/teams", { slug }) },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/d4h/teams/[d4h_team_id]", {
                            slug,
                            d4h_team_id: String(team.id),
                        }),
                    },
                    {
                        label: "Members",
                        href: route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members", {
                            slug,
                            d4h_team_id: String(team.id),
                        }),
                    },
                    { label: member.name },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{member.name}</Saratoga.Title>
                    </Saratoga.Header>
                    <div className="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Member Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataList>
                                    <DataItem inline>
                                        <DataItemTitle>D4H ID</DataItemTitle>
                                        <DataItemValue>{member.id}</DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Name</DataItemTitle>
                                        <DataItemValue>{member.name}</DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Email</DataItemTitle>
                                        <DataItemValue>{member.email.value}</DataItemValue>
                                    </DataItem>
                                    {member.ref && (
                                        <DataItem inline>
                                            <DataItemTitle>Ref</DataItemTitle>
                                            <DataItemValue>{member.ref}</DataItemValue>
                                        </DataItem>
                                    )}
                                    {member.position && (
                                        <DataItem inline>
                                            <DataItemTitle>Position</DataItemTitle>
                                            <DataItemValue>{member.position}</DataItemValue>
                                        </DataItem>
                                    )}
                                    <DataItem inline>
                                        <DataItemTitle>Team</DataItemTitle>
                                        <DataItemValue>
                                            <D4HTeamLink team={team} />
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>D4H Status</DataItemTitle>
                                        <DataItemValue>
                                            {formatD4HMemberStatus(member.status)}
                                        </DataItemValue>
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </Card>
                        <div>
                            <div className="mb-2 text-lg font-semibold">Issued Equipment</div>
                            <Kaga.TableToolbar table={table} />
                            <Kaga.Table table={table} />
                            <Kaga.TablePagination table={table} />
                        </div>
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
