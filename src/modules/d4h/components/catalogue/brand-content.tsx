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
import { D4HEquipmentModel } from "@/lib/schemas/d4h/equipment-model";
import { D4HModule_Owner } from "@/modules/d4h/components/catalogue/owner";
import { trpc } from "@/trpc/client";

/** One D4H equipment brand: its details and its models. */
export function D4HModule_Brand_Content({ brandId }: { brandId: number }) {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: brands } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentBrands.queryOptions({ organizationId: organization.id }),
    );
    const { data: allModels } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentModels.queryOptions({ organizationId: organization.id }),
    );

    const brand = brands.find((b) => b.id === brandId);
    if (!brand) notFound();

    const models = useMemo(
        () => allModels.filter((model) => model.brand.id === brandId),
        [allModels, brandId],
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HEquipmentModel>((columnHelper) => [
                columnHelper.accessor("title", {
                    header: "Title",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                // A model's owner carries no title, so only its kind can be shown.
                columnHelper.accessor("owner.resourceType", {
                    header: "Owner",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: models,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "title", desc: false }],
        },
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Brands", href: route("/orgs/[slug]/d4h/brands", { slug }) },
                    { label: brand.title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{brand.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <div className="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Brand Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataList>
                                    <DataItem inline>
                                        <DataItemTitle>Title</DataItemTitle>
                                        <DataItemValue>{brand.title}</DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Owner</DataItemTitle>
                                        <DataItemValue>
                                            <D4HModule_Owner owner={brand.owner} />
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Updated</DataItemTitle>
                                        <DataItemDateValue date={brand.updatedAt} />
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </Card>
                        <div>
                            <div className="mb-2 text-lg font-semibold">Models</div>
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
