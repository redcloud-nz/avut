/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/categories
 */
"use client";

import { useMemo } from "react";

import { count, eq, useLiveSuspenseQuery } from "@tanstack/react-db";
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
import Link from "next/link";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentKindsCollection } from "@/lib/collections/d4h-equipment-kinds";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import { route } from "@/lib/routes";

export default function D4HViewsModule_EquipmentCategories_Page(
    props: PageProps<"/main/[slug]/d4h-views/equipment/categories">,
) {
    const organization = useOrganization();

    const { data: categories } = useLiveSuspenseQuery((q) => {
        const kindCounts = q
            .from({
                kind: getD4HEquipmentKindsCollection(organization.id),
            })
            .groupBy(({ kind }) => kind.category.id)
            .select(({ kind }) => ({
                categoryId: kind.category.id,
                count: count(kind.id),
            }));

        return q
            .from({
                category: getD4HEquipmentCategoriesCollection(organization.id),
            })
            .join({ kindCount: kindCounts }, ({ category, kindCount }) =>
                eq(category.id, kindCount.categoryId),
            )
            .select(({ category, kindCount }) => ({
                ...category,
                kindCount: kindCount?.count,
            }));
    });

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof categories)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: "Category ID",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("title", {
                    header: "Title",
                    cell: (ctx) => (
                        <Link
                            href={route(
                                "/main/[slug]/d4h-views/equipment/categories/[category_id]",
                                {
                                    slug: organization.slug,
                                    category_id: String(ctx.row.original.id),
                                },
                            )}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("kindCount", {
                    header: "Kinds",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("owner.title", {
                    header: "Owner",
                    cell: (ctx) => (
                        <>
                            <span>{ctx.getValue()}</span>
                            <span className="text-muted-foreground pl-2">
                                ({ctx.row.original.owner.resourceType})
                            </span>
                        </>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug],
    );

    const table = useReactTable({
        data: categories,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: Kaga.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "title", desc: false }],
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
                    "Categories",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Equipment Categories</Saratoga.Title>
                    </Saratoga.Header>
                    <div>
                        <Kaga.TableToolbar table={table} />
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
