/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo } from "react";

import { useLiveSuspenseQuery } from "@tanstack/react-db";

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

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

import { getTeamsCollection } from "@/lib/collections/teams";
import { OrganizationData } from "@/lib/schemas/organization";
import { TeamData } from "@/lib/schemas/team";
import * as Paths from "@/paths";

interface AdminModule_TeamsListProps {
    organization: OrganizationData;
}

/**
 * List of teams in the organization.
 */
export function AdminModule_TeamsList({
    organization,
}: AdminModule_TeamsListProps) {
    const { data: teams } = useLiveSuspenseQuery((q) =>
        q.from({ team: getTeamsCollection(organization.id) }),
    );

    type RowData = TeamData;

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
                                to={Paths.org(organization.slug).admin.team(
                                    ctx.row.original.id,
                                )}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
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
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
            ]),
        [organization.slug],
    );

    const table = useReactTable({
        data: teams,
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
        <Hermes.Section>
            <Hermes.Header>
                <Akagi.TableSearch table={table} />
                <Protect
                    orgId={organization.id}
                    permissions={{ team: ["create"] }}
                >
                    <Button variant="outline" asChild>
                        <Link
                            to={Paths.org(organization.slug).admin.teams.create}
                        >
                            <CreateNewIcon /> Team
                        </Link>
                    </Button>
                </Protect>
            </Hermes.Header>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
