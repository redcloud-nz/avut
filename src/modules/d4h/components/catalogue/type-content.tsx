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
import { D4HOwner } from "@/components/d4h/d4h-owner";
import { D4HEquipmentBrandLink } from "@/components/entity-links/d4h-equipment-brand-link";
import { D4HEquipmentCategoryLink } from "@/components/entity-links/d4h-equipment-category-link";
import { D4HEquipmentItemLink } from "@/components/entity-links/d4h-equipment-item-link";
import { D4HEquipmentModelLink } from "@/components/entity-links/d4h-equipment-model-link";
import { D4HMemberLink } from "@/components/entity-links/d4h-member-link";
import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { useReachableTeamIds } from "@/modules/d4h/lib/use-reachable-team-ids";
import { trpc } from "@/trpc/client";

/** One D4H equipment type: its details and its current items across every team. */
export function D4HModule_Type_Content({ typeId }: { typeId: number }) {
    const organization = useOrganization();
    const reachableTeamIds = useReachableTeamIds();
    const { slug } = organization;

    const { data: kinds } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
    );

    // Check the type before reading its items, so an unknown type shows the not-found panel.
    const kind = kinds.find((k) => k.id === typeId);
    if (!kind) notFound();

    const { data: items } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentKindItems.queryOptions({
            organizationId: organization.id,
            kindId: typeId,
        }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof items)[number]>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: "Ref",
                    cell: (ctx) => {
                        const { team, owner, id, ref } = ctx.row.original;
                        // The item page lives under the owning team. A row that fell back to the
                        // team listing it (owner out of reach) has no page to link to.
                        if (team.id !== owner.id) return <D4HItemRef value={ref} />;
                        return <D4HEquipmentItemLink item={{ id, ref, owner }} />;
                    },
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("team.title", {
                    header: "Team",
                    cell: (ctx) => {
                        const { team } = ctx.row.original;
                        return <D4HTeamLink team={{ ...team, resourceType: "Team" }} />;
                    },
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor(
                    (item) =>
                        item.holder ? (item.holder.name ?? `Member #${item.holder.id}`) : "",
                    {
                        id: "holder",
                        header: "Holder",
                        cell: (ctx) => {
                            const { holder, team } = ctx.row.original;
                            // Not held by a member: the item page's Parents says where it is.
                            if (!holder) return "—";
                            // A holder missing from the team's member list (e.g. a retired
                            // member) has no name, and no member page.
                            return (
                                <D4HMemberLink
                                    member={{ id: holder.id, name: holder.name, owner: team }}
                                />
                            );
                        },
                        enableGlobalFilter: true,
                        enableSorting: true,
                        enableColumnFilter: false,
                    },
                ),
                columnHelper.accessor((item) => item.brand.title ?? "", {
                    id: "brand",
                    header: "Brand",
                    cell: (ctx) => {
                        const { brand, team, owner } = ctx.row.original;
                        // An owner out of reach may own the brand, which then has no page here.
                        if (team.id !== owner.id || brand.id == null || !brand.title) {
                            return ctx.getValue() || "—";
                        }
                        return (
                            <D4HEquipmentBrandLink brand={{ id: brand.id, title: brand.title }} />
                        );
                    },
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((item) => item.model?.title ?? "", {
                    id: "model",
                    header: "Model",
                    cell: (ctx) => {
                        const { brand, model, team, owner } = ctx.row.original;
                        if (
                            team.id !== owner.id ||
                            model?.id == null ||
                            !model.title ||
                            brand.id == null
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
                        // `listEquipmentKindItems` asks for current items only, so no wishlist.
                        columnOptions: D4HEquipmentStatus.schema.options
                            .filter((value) => value !== "WISHLIST")
                            .map((value) => ({ value, label: D4HEquipmentStatus.label(value) })),
                    },
                }),
            ]),
        [],
    );

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
                    {
                        label: "Equipment Categories",
                        href: route("/orgs/[slug]/d4h/categories", { slug }),
                    },
                    {
                        label: kind.category.title,
                        href: route("/orgs/[slug]/d4h/categories/[category_id]", {
                            slug,
                            category_id: String(kind.category.id),
                        }),
                    },
                    { label: kind.title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{kind.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <div className="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Type Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataList>
                                    <DataItem inline>
                                        <DataItemTitle>Title</DataItemTitle>
                                        <DataItemValue>{kind.title}</DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Category</DataItemTitle>
                                        <DataItemValue>
                                            <D4HEquipmentCategoryLink category={kind.category} />
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Owner</DataItemTitle>
                                        <DataItemValue>
                                            <D4HOwner
                                                owner={kind.owner}
                                                linkable={reachableTeamIds.has(kind.owner.id)}
                                            />
                                        </DataItemValue>
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </Card>
                        <div>
                            <div className="mb-2 text-lg font-semibold">Items</div>
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
