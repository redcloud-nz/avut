/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentKind } from "@/lib/schemas/d4h/equipment-kind";
import { D4HModule_Owner } from "@/modules/d4h/components/catalogue/owner";
import { trpc } from "@/trpc/client";

/** Every D4H equipment type the token reaches, org-wide, with its category. */
export function D4HModule_Types_List() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: kinds } = useSuspenseQuery(
        trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
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
                columnHelper.accessor("category.title", {
                    header: "Category",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h/categories/[category_id]", {
                                slug,
                                category_id: String(ctx.row.original.category.id),
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
        data: kinds,
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
                    { label: "Types" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Types</Saratoga.Title>
                    </Saratoga.Header>
                    <div>
                        <Kaga.TableToolbar table={table} />
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
