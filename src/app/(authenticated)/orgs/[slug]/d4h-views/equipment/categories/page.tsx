/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories
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

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentKindsCollection } from "@/lib/collections/d4h-equipment-kinds";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import * as Paths from "@/paths";

export default function D4HViewsModule_EquipmentCategories_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/categories">,
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
            Akagi.defineColumns<(typeof categories)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} align="center">
                            Category ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} align="center">
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
                columnHelper.accessor("title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Title
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(
                                    organization.slug,
                                ).d4HViews.equipment.category(
                                    ctx.row.original.id,
                                )}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("kindCount", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} align="center">
                            Kinds
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} align="center">
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
                columnHelper.accessor("owner.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            className="w-1/4"
                        >
                            Owner
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} className="w-1/4">
                            <span>{ctx.getValue()}</span>
                            <span className="text-muted-foreground pl-2">
                                ({ctx.row.original.owner.resourceType})
                            </span>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
            ]),
        [],
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
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "title", desc: false }],
        },
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(organization.slug).d4HViews.index,
                    Paths.org(organization.slug).d4HViews.equipment.index,
                    Paths.org(organization.slug).d4HViews.equipment.categories,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={
                                Paths.org(organization.slug).d4HViews.equipment
                                    .index
                            }
                        />
                        <Hermes.Title>Equipment Categories</Hermes.Title>
                        <Hermes.Search>
                            <Akagi.TableSearch table={table} />
                        </Hermes.Search>
                    </Hermes.Header>
                    <Akagi.Table table={table} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
