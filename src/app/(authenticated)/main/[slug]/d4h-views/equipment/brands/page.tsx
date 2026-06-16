/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/brands
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
import { getD4HEquipmentBrandsCollection } from "@/lib/collections/equipment-brands";
import { route } from "@/lib/routes";
import { getD4HEquipmentModelsCollection } from "@/lib/collections/equipment-models";

export default function D4HViewsModule_EquipmentBrands_Page(
    props: PageProps<"/main/[slug]/d4h-views/equipment/brands">,
) {
    const organization = useOrganization();

    const { data: brands } = useLiveSuspenseQuery((q) => {
        const modelCounts = q
            .from({ model: getD4HEquipmentModelsCollection(organization.id) })
            .groupBy(({ model }) => model.brand.id)
            .select(({ model }) => ({
                brandId: model.brand.id,
                count: count(model.id),
            }));

        return q
            .from({
                brand: getD4HEquipmentBrandsCollection(organization.id),
            })
            .join({ modelCount: modelCounts }, ({ brand, modelCount }) =>
                eq(brand.id, modelCount.brandId),
            )
            .select(({ brand, modelCount }) => ({
                ...brand,
                modelCount: modelCount?.count,
            }));
    });

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof brands)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: "Brand ID",
                    cell: (ctx) => (
                        <Link
                            href={route("/main/[slug]/d4h-views/equipment/brands/[brand_id]", {
                                slug: organization.slug,
                                brand_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("title", {
                    header: "Title",
                    cell: (ctx) => (
                        <Link
                            href={route("/main/[slug]/d4h-views/equipment/brands/[brand_id]", {
                                slug: organization.slug,
                                brand_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("modelCount", {
                    header: "Models",
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
        data: brands,
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
                    "Brands",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Equipment Brands</Saratoga.Title>
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
