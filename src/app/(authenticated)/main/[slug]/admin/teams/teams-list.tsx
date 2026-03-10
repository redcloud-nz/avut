/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

import { OrganizationData } from "@/lib/schemas/organization";
import { TeamData } from "@/lib/schemas/team";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";
import { useOrganization } from "@/hooks/use-organization";
import { AdminModule_CreateTeam_Dialog } from "./create-team";

/**
 * List of teams in the organization.
 */
export function AdminModule_TeamsList() {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({
            organizationId: organization.id,
        }),
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
                                to={
                                    Paths.main(organization.slug).admin.team(
                                        ctx.row.original.id,
                                    ).index
                                }
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

    const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);

    return (
        <>
            <div className="flex items-center justify-between">
                <Akagi.TableSearch table={table} />
                <Protect
                    orgId={organization.id}
                    permissions={{ team: ["create"] }}
                >
                    <Button
                        variant="outline"
                        tooltip="Add Team"
                        onClick={() => setCreateTeamDialogOpen(true)}
                    >
                        <CreateNewIcon /> New
                    </Button>
                </Protect>
            </div>
            <Akagi.Table table={table} />
            <AdminModule_CreateTeam_Dialog
                open={createTeamDialogOpen}
                onOpenChange={setCreateTeamDialogOpen}
            />
        </>
    );
}
