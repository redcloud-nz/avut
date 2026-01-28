/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";

import { S2_Button } from "@/components/ui/s2-button";
import { Link } from "@/components/ui/link";

import { OrganizationData } from "@/lib/schemas/organization";
import { PersonData } from "@/lib/schemas/person";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface AdminModule_PersonnelListProps {
    organization: OrganizationData;
}

/**
 * List of personnel in the organization.
 */
export function AdminModule_PersonnelList({
    organization,
}: AdminModule_PersonnelListProps) {
    const { data: personnel } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({
            organizationId: organization.id,
        }),
    );

    const adminModule = Paths.org(organization.slug).admin;
    type RowData = PersonData;

    const columns = useMemo(
        () =>
            Akagi.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeader header={ctx.header}>
                            Name
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link to={adminModule.person(ctx.row.original.id)}>
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("email", {
                    header: (ctx) => (
                        <Akagi.TableHeader header={ctx.header}>
                            Email
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeader
                            header={ctx.header}
                            filterOptions={["Active", "Archived", "Deleted"]}
                        >
                            Status
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: "arrIncludesSome",
                }),
            ]),
        [],
    );

    const table = useReactTable<RowData>({
        columns,
        data: personnel,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Hermes.Section>
            <Hermes.SectionHeader>
                <Akagi.TableSearch table={table} />
                <Protect
                    orgId={organization.id}
                    permissions={{ person: ["create"] }}
                >
                    <S2_Button variant="outline" asChild>
                        <Link to={adminModule.personnel.create}>
                            <CreateNewIcon /> Person
                        </Link>
                    </S2_Button>
                </Protect>
            </Hermes.SectionHeader>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
