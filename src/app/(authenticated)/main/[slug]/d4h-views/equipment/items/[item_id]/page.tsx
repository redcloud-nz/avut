/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/categories/[category_id]
 */
"use client";

import { CornerDownRightIcon } from "lucide-react";
import { use, useMemo } from "react";

import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
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
import { Show } from "@/components/show";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import { getD4HEquipmentItemsCollection } from "@/lib/collections/d4h-equipment-items";
import { route } from "@/lib/routes";

export default function D4HViewsModule_EquipmentItem_Page(
    props: PageProps<"/main/[slug]/d4h-views/equipment/items/[item_id]">,
) {
    const { item_id } = use(props.params);
    const itemId = parseInt(item_id, 10);

    const organization = useOrganization();

    const { data: item } = useLiveSuspenseQuery((q) =>
        q
            .from({
                item: getD4HEquipmentItemsCollection(organization.id),
            })
            .join(
                {
                    category: getD4HEquipmentCategoriesCollection(organization.id),
                },
                ({ item, category }) => eq(item.category.id, category.id),
            )
            .where(({ item }) => eq(item.id, itemId))
            .select(({ item, category }) => ({ ...item, category }))
            .findOne(),
    );
    const { data: contents = [], isReady: isContentsReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    item: getD4HEquipmentItemsCollection(organization.id),
                })
                .where(({ item }) => eq(item.parentId, itemId)),
        [organization.id, itemId],
    );

    if (!item) throw new Error(`EquipmentItem(${itemId}) not found`);

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof contents)[number]>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: "Ref",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("kind.title", {
                    header: "Kind",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("model.title", {
                    header: "Model",
                    cell: (ctx) => ctx.getValue() ?? "",
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableSorting: false,
                    meta: {
                        columnOptions: [
                            { label: "OPERATIONAL", value: "OPERATIONAL" },
                            { label: "UNSERVICEABLE", value: "UNSERVICEABLE" },
                            { label: "RETIRED", value: "RETIRED" },
                        ],
                    },
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: contents,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["OPERATIONAL", "UNSERVICEABLE"] }],
            pagination: {
                pageIndex: 0,
                pageSize: Kaga.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Views",
                        href: route("/main/[slug]/d4h-views", { slug: organization.slug }),
                    },
                    {
                        label: "Equipment",
                        href: route("/main/[slug]/d4h-views/equipment", {
                            slug: organization.slug,
                        }),
                    },
                    "Items",
                    item.ref,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{item.ref}</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Item Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DL>
                                <DLTerm>Item ID</DLTerm>
                                <DLDetails>{item.id}</DLDetails>
                                <DLTerm>Reference</DLTerm>
                                <DLDetails>{item.ref}</DLDetails>
                                {item.category && (
                                    <>
                                        <DLTerm>Category</DLTerm>
                                        <DLDetails>
                                            <Link
                                                href={route(
                                                    "/main/[slug]/d4h-views/equipment/categories/[category_id]",
                                                    {
                                                        slug: organization.slug,
                                                        category_id: String(item.category.id),
                                                    },
                                                )}
                                            >
                                                {item.category.title}
                                            </Link>
                                        </DLDetails>
                                    </>
                                )}
                                <DLTerm>Kind</DLTerm>
                                <DLDetails>{item.kind.title}</DLDetails>
                                <DLTerm>Brand</DLTerm>
                                <DLDetails>{item.brand?.title ?? ""}</DLDetails>
                                <DLTerm>Model</DLTerm>
                                <DLDetails>{item.model?.title ?? ""}</DLDetails>
                                <DLTerm>Parents</DLTerm>
                                <DLDetails>
                                    <div className="flex flex-col">
                                        {item.parents.map((parent, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    paddingLeft: `${index * 1.5}rem`,
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {index > 0 && (
                                                        <CornerDownRightIcon className="size-4 text-muted-foreground" />
                                                    )}
                                                    <div className="pt-1">
                                                        <Link
                                                            href={route(
                                                                "/main/[slug]/d4h-views/equipment/items/[item_id]",
                                                                {
                                                                    slug: organization.slug,
                                                                    item_id: String(parent.id),
                                                                },
                                                            )}
                                                        >
                                                            {parent.ref}
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </DLDetails>
                                <DLTerm>Status</DLTerm>
                                <DLDetails>{item.status}</DLDetails>
                            </DL>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between mt-4">
                        <div className="text-lg font-semibold">Contents</div>
                    </div>
                    <Kaga.TableToolbar table={table} />
                    <Show when={isContentsReady} fallback={<Skeleton className="w-full h-10" />}>
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </Show>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
