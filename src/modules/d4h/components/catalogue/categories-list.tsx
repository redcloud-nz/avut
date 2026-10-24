/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HModule_Owner } from "@/modules/d4h/components/catalogue/owner";
import { trpc } from "@/trpc/client";

/** Every D4H equipment category the token reaches, org-wide, with how many types each holds. */
export function D4HModule_Categories_List() {
    const organization = useOrganization();
    const { slug } = organization;

    const [{ data: categories }, { data: kinds }] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }),
            trpc.d4hApi.listEquipmentKinds.queryOptions({ organizationId: organization.id }),
        ],
    });

    const rows = useMemo(() => {
        const typeCounts = new Map<number, number>();
        for (const kind of kinds) {
            typeCounts.set(kind.category.id, (typeCounts.get(kind.category.id) ?? 0) + 1);
        }
        return categories.map((category) => ({
            ...category,
            typeCount: typeCounts.get(category.id) ?? 0,
        }));
    }, [categories, kinds]);

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof rows)[number]>((columnHelper) => [
                columnHelper.accessor("title", {
                    header: "Title",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h/categories/[category_id]", {
                                slug,
                                category_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("typeCount", {
                    header: "Types",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
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
        data: rows,
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
                    { label: "Categories" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Categories</Saratoga.Title>
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
