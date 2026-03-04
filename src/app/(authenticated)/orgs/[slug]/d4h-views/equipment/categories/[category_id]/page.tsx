/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories/[category_id]
 */
"use client";

import { use, useMemo } from "react";

import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import { getD4HEquipmentItemsCollection } from "@/lib/collections/d4h-equipment-items";
import { D4HEquipmentItem } from "@/lib/d4h-api/equipment-item";
import * as Paths from "@/paths";
import { Show } from "@/components/show";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/components/ui/link";

export default function D4HViewsModule_EquipmentCategory_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/categories/[category_id]">,
) {
    const { category_id } = use(props.params);
    const categoryId = parseInt(category_id, 10);

    const organization = useOrganization();

    const { data: category } = useLiveSuspenseQuery((q) =>
        q
            .from({
                category: getD4HEquipmentCategoriesCollection(organization.id),
            })
            .where(({ category }) => eq(category.id, categoryId))
            .findOne(),
    );
    const { data: items = [], isReady: isItemsReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    item: getD4HEquipmentItemsCollection(organization.id),
                })
                .where(({ item }) => eq(item.category.id, categoryId)),
        [organization.id, categoryId],
    );

    if (!category) throw new Error("Category not found");

    const columns = useMemo(
        () =>
            Akagi.defineColumns<D4HEquipmentItem>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Ref
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(
                                    organization.slug,
                                ).d4hViews.equipment.item(ctx.row.original.id)}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("kind.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Kind
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("model.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Model
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue() ?? ""}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={[
                                "OPERATIONAL",
                                "UNSERVICEABLE",
                                "RETIRED",
                            ]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    filterFn: "arrIncludesSome",
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableSorting: false,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [
                { id: "status", value: ["OPERATIONAL", "UNSERVICEABLE"] },
            ],
            pagination: {
                pageIndex: 0,
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(organization.slug).d4hViews.index,
                    Paths.org(organization.slug).d4hViews.equipment.index,
                    Paths.org(organization.slug).d4hViews.equipment.categories,
                    category.title,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={
                                Paths.org(organization.slug).d4hViews.equipment
                                    .categories
                            }
                        />
                        <Hermes.Title>
                            Items in Category: {category.title}
                        </Hermes.Title>
                        <Hermes.Search>
                            <Akagi.TableSearch table={table} />
                        </Hermes.Search>
                    </Hermes.Header>
                    <Show
                        when={isItemsReady}
                        fallback={<Skeleton className="w-full h-10" />}
                    >
                        <Akagi.Table table={table} />
                    </Show>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
