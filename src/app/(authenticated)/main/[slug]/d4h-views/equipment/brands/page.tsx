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

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
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
            Akagi.defineColumns<(typeof brands)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} align="center">
                            Brand ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} align="center">
                            <Link
                                href={route("/main/[slug]/d4h-views/equipment/brands/[brand_id]", {
                                    slug: organization.slug,
                                    brand_id: String(ctx.row.original.id),
                                })}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
                columnHelper.accessor("title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Title</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                href={route("/main/[slug]/d4h-views/equipment/brands/[brand_id]", {
                                    slug: organization.slug,
                                    brand_id: String(ctx.row.original.id),
                                })}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("modelCount", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} align="center">
                            Models
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
                        <Akagi.TableHeadCell header={ctx.header} className="w-1/4">
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
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "title", desc: false }],
        },
    });

    return (
        <Lexington.Root>
            <Lexington.Header
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
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/d4h-views/equipment", {
                                slug: organization.slug,
                            })}
                        />
                        <Hermes.Title>Equipment Brands</Hermes.Title>
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
