/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
import { HelpButton } from "@/components/docs/help-button";
import { D4HEquipmentBrandLink } from "@/components/entity-links/d4h-equipment-brand-link";
import { D4HEquipmentItemLink } from "@/components/entity-links/d4h-equipment-item-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { D4HMemberLink } from "@/components/entity-links/d4h-member-link";
import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { useReachableTeamIds } from "@/modules/d4h/lib/use-reachable-team-ids";
import { trpc } from "@/trpc/client";

/** One D4H equipment model: its details and its current items across every team. */
export function D4HModule_Model_Content({ modelId }: { modelId: number }) {
    const organization = useOrganization();
    const reachableTeamIds = useReachableTeamIds();
    const { slug } = organization;

    const {
        data: { model, items },
    } = useSuspenseQuery(
        trpc.d4hApi.getEquipmentModel.queryOptions({ organizationId: organization.id, modelId }),
    );
    const { brand } = model;

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
                columnHelper.accessor("kind.title", {
                    header: "Type",
                    cell: (ctx) => {
                        const { kind, team, owner } = ctx.row.original;
                        // An owner out of reach may own the type, which then has no page here.
                        if (team.id !== owner.id) return kind.title;
                        return <D4HEquipmentTypeLink type={{ id: kind.id, title: kind.title }} />;
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
                columnHelper.accessor("status", {
                    header: "D4H Status",
                    cell: (ctx) => D4HEquipmentStatus.label(ctx.getValue()),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    meta: {
                        // `getEquipmentModel` asks for current items only, so no wishlist.
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
                    { label: "Equipment Brands", href: route("/orgs/[slug]/d4h/brands", { slug }) },
                    brand.title
                        ? {
                              label: brand.title,
                              href: route("/orgs/[slug]/d4h/brands/[brand_id]", {
                                  slug,
                                  brand_id: String(brand.id),
                              }),
                          }
                        : { label: "Unknown brand" },
                    { label: model.title },
                ]}
                actions={<HelpButton id="d4h" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{model.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <div className="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Model Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataList>
                                    <DataItem inline>
                                        <DataItemTitle>Title</DataItemTitle>
                                        <DataItemValue>{model.title}</DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Brand</DataItemTitle>
                                        <DataItemValue>
                                            {brand.title ? (
                                                <D4HEquipmentBrandLink
                                                    brand={{ id: brand.id, title: brand.title }}
                                                />
                                            ) : (
                                                "—"
                                            )}
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Owner</DataItemTitle>
                                        <DataItemValue>
                                            <D4HOwner
                                                owner={model.owner}
                                                linkable={reachableTeamIds.has(model.owner.id)}
                                            />
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Updated</DataItemTitle>
                                        <DataItemDateValue date={model.updatedAt} />
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
