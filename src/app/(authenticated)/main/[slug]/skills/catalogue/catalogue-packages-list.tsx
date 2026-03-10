/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo, useState } from "react";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { Akagi } from "@/components/blocks/akagi";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

export function SkillsModule_CataloguePackages_List() {
    const organization = useOrganization();

    const { data: packages } = useSuspenseQuery(
        trpc.skills.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    const columns = useMemo(
        () =>
            Akagi.defineColumns<(typeof packages)[0]>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Package Name
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.main(
                                    organization.slug,
                                ).skills.cataloguePackage(ctx.row.original.id)}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("organization.name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Publisher
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("skillCount", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            align="center"
                            className="w-16"
                        >
                            Skills
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} align="center">
                            {ctx.getValue() + ""}
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                }),
                columnHelper.accessor("subscriptionCount", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            align="center"
                            className="w-30"
                        >
                            Subscriptions
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell
                            cell={ctx.cell}
                            align="center"
                            className="w-30"
                        >
                            {ctx.getValue() + ""}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                }),
                columnHelper.accessor("subscription", {
                    id: "status",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue() ? "Subscribed" : ""}
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                }),
            ]),
        [organization.slug],
    );

    const table = useReactTable({
        data: packages,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-between">
                <Akagi.TableSearch table={table} />
            </div>
            <Akagi.Table table={table} />
        </>
    );
}
