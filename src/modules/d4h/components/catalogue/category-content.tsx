/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useMemo } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";
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
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { D4HModule_Owner } from "@/modules/d4h/components/catalogue/owner";
import { trpc } from "@/trpc/client";

/** One D4H equipment category: its details and the types in it. */
export function D4HModule_Category_Content({ categoryId }: { categoryId: number }) {
    const organization = useOrganization();
    const { slug } = organization;

    const [{ data: categories }, { data: kinds }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
            trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
        ],
    });

    const category = categories.find((c) => c.id === categoryId);
    if (!category) notFound();

    const types = useMemo(
        () => kinds.filter((kind) => kind.category.id === categoryId),
        [kinds, categoryId],
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HEquipmentKind>((columnHelper) => [
                columnHelper.accessor("title", {
                    header: "Title",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h/types/[type_id]", {
                                slug,
                                type_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("owner.title", {
                    header: "Owner",
                    cell: (ctx) => <D4HModule_Owner owner={ctx.row.original.owner} />,
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: types,
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
                    { label: "Categories", href: route("/orgs/[slug]/d4h/categories", { slug }) },
                    { label: category.title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{category.title}</Saratoga.Title>
                    </Saratoga.Header>
                    <div className="flex flex-col gap-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Category Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <DataList>
                                    <DataItem inline>
                                        <DataItemTitle>Title</DataItemTitle>
                                        <DataItemValue>{category.title}</DataItemValue>
                                    </DataItem>
                                    <DataItem inline>
                                        <DataItemTitle>Owner</DataItemTitle>
                                        <DataItemValue>
                                            <D4HModule_Owner owner={category.owner} />
                                        </DataItemValue>
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </Card>
                        <div>
                            <div className="mb-2 text-lg font-semibold">Types</div>
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
