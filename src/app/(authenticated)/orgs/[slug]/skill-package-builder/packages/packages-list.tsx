/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import Artie from "@/components/art/artie";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Show } from "@/components/show";

import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";

import { route } from "@/lib/routes";
import { OrganizationData } from "@/lib/schemas/organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_CreatePackage_Dialog } from "./create-package";

interface SkillPackageBuilder_Packages_ListProps {
    organization: OrganizationData;
}

export function SkillPackageBuilder_Packages_List({
    organization,
}: SkillPackageBuilder_Packages_ListProps) {
    const { data: skillPackages } = useSuspenseQuery(
        trpc.skillPackageBuilder.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = SkillPackage;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route(
                                "/orgs/[slug]/skill-package-builder/packages/[package_id]",
                                { slug: organization.slug, package_id: ctx.row.original.id },
                            )}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("description", {
                    header: "Description",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: false,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: "Active", value: "Active" },
                            { label: "Archived", value: "Archived" },
                        ],
                    },
                }),
                columnHelper.accessor("published", {
                    header: "Published",
                    cell: (ctx) => (ctx.getValue() ? "Yes" : "No"),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: "Yes", value: true },
                            { label: "No", value: false },
                        ],
                    },
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: skillPackages,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [
                { id: "status", value: ["Active"] },
                { id: "published", value: [true] },
            ],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    const [createPackageDialogOpen, setCreatePackageDialogOpen] = useState(false);

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skill Packages</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ skillPackageBuilder: ["create"] }}>
                        <Button variant="outline" onClick={() => setCreatePackageDialogOpen(true)}>
                            <CreateNewIcon /> New
                        </Button>
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <Show
                when={skillPackages.length > 0}
                fallback={
                    <Empty>
                        <EmptyMedia>
                            <Artie pose="Empty" size="sm" />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle>No skill packages yet.</EmptyTitle>
                            <EmptyDescription>
                                Your organization does not have any skill packages yet.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <Protect
                                permissions={{
                                    skillPackageBuilder: ["create"],
                                }}
                            >
                                <Button onClick={() => setCreatePackageDialogOpen(true)}>
                                    Create Package
                                </Button>
                            </Protect>
                        </EmptyContent>
                    </Empty>
                }
            >
                <div>
                    <Kaga.TableToolbar table={table} />
                    <Kaga.Table table={table} />
                    <Kaga.TablePagination table={table} />
                </div>
            </Show>
            <SkillPackageBuilder_CreatePackage_Dialog
                open={createPackageDialogOpen}
                onOpenChange={setCreatePackageDialogOpen}
            />
        </Saratoga.Root>
    );
}
