/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";

import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

import { OrganizationData } from "@/lib/schemas/organization";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { useSuspenseQuery } from "@tanstack/react-query";
import { trpc } from "@/trpc/client";

interface SkillPackageAuthorModules_SkillPackagesListProps {
    organization: OrganizationData;
}

/**
 * List of skill packages in the organization.
 */
export function SkillPackageAuthorModules_SkillPackages_List({
    organization,
}: SkillPackageAuthorModules_SkillPackagesListProps) {
    const { data: skillPackages } = useSuspenseQuery(
        trpc.skills.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = SkillPackage;

    const columns = useMemo(
        () =>
            Akagi.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Name
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(
                                    organization.slug,
                                ).skillPackageAuthor.skillPackage(
                                    ctx.row.original.id,
                                )}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                }),
                columnHelper.accessor("description", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Description
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            className="w-25"
                            filterOptions={["Active", "Archived"]}
                        >
                            Status
                        </Akagi.TableHeadCell>
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
        [organization.slug],
    );

    const table = useReactTable({
        data: skillPackages,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["Active"] }],
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
                    permissions={{ skillPackage: ["create"] }}
                >
                    <Button variant="outline" asChild>
                        <Link
                            to={
                                Paths.org(organization.slug).skillPackageAuthor
                                    .skillPackages.create
                            }
                        >
                            <CreateNewIcon /> Skill Package
                        </Link>
                    </Button>
                </Protect>
            </Hermes.SectionHeader>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
