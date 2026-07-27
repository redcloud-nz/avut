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

import { UsersIcon } from "lucide-react";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Show } from "@/components/show";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function SkillTrack_PersonPicker() {
    const organization = useOrganization();

    const { data: personnel } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({
            organizationId: organization.id,
        }),
    );

    // `listPersonnel` returns everything that isn't deleted, but the competency report only
    // resolves active personnel — archived people would render an empty report.
    const activePersonnel = useMemo(
        () => personnel.filter((person) => person.status === "Active"),
        [personnel],
    );

    type Row = (typeof activePersonnel)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Row>((col) => [
                col.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/skill-track/reports/person/[person_id]", {
                                slug: organization.slug,
                                person_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor("email", {
                    header: "Email",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: activePersonnel,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Select a Person</Saratoga.Title>
            </Saratoga.Header>
            <Show
                when={activePersonnel.length > 0}
                fallback={
                    <Empty>
                        <EmptyMedia>
                            <UsersIcon className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>
                            There are no active personnel in this organization.
                        </EmptyDescription>
                    </Empty>
                }
            >
                <div>
                    <Kaga.TableToolbar table={table} />
                    <Kaga.Table table={table} />
                    <Kaga.TablePagination table={table} />
                </div>
            </Show>
        </Saratoga.Root>
    );
}
