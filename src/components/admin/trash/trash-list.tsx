/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { personnelEffects } from "@/client/personnel-effects";
import { teamsEffects } from "@/client/teams-effects";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { MutationButton } from "@/components/ui/button";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { TrashableEntities } from "@/lib/trash-registry";
import { trpc } from "@/trpc/client";

type TrashRow = {
    id: string;
    type: "Person" | "Team";
    name: string;
    deletedAt: string | null;
};

function RestoreCell({ row }: { row: TrashRow }) {
    const organization = useOrganization();
    const canRestorePerson = useHasPermission({ person: ["delete"] });
    const canRestoreTeam = useHasPermission({ team: ["delete"] });

    const restorePerson = useMutation(
        trpc.personnel.restorePersonFromTrash.mutationOptions({
            meta: { effects: personnelEffects.restorePersonFromTrash },
            onError(error) {
                toast.error(`Failed to restore person: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Person "${row.name}" restored from trash.`);
            },
        }),
    );
    const restoreTeam = useMutation(
        trpc.teams.restoreTeamFromTrash.mutationOptions({
            meta: { effects: teamsEffects.restoreTeamFromTrash },
            onError(error) {
                toast.error(`Failed to restore team: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Team "${row.name}" restored from trash.`);
            },
        }),
    );

    if (row.type === "Person") {
        return (
            <MutationButton
                type="button"
                variant="outline"
                size="sm"
                disabled={!canRestorePerson}
                status={restorePerson.status}
                text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
                onClick={() =>
                    restorePerson.mutate({ organizationId: organization.id, personId: row.id })
                }
            />
        );
    }

    return (
        <MutationButton
            type="button"
            variant="outline"
            size="sm"
            disabled={!canRestoreTeam}
            status={restoreTeam.status}
            text={{ idle: "Restore", pending: "Restoring", success: "Restored" }}
            onClick={() => restoreTeam.mutate({ organizationId: organization.id, teamId: row.id })}
        />
    );
}

export function AdminModule_Trash_List() {
    const organization = useOrganization();
    const { formatRelativeDateTime } = usePreferences();

    const { data: rows } = useSuspenseQuery(
        trpc.trash.listTrash.queryOptions({ organizationId: organization.id }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<TrashRow>((columnHelper) => [
                columnHelper.accessor("type", {
                    header: "Type",
                    cell: (ctx) =>
                        TrashableEntities[ctx.getValue().toLowerCase() as "person" | "team"].label,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    enableHiding: false,
                }),
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => {
                        const row = ctx.row.original;
                        const entity =
                            TrashableEntities[row.type.toLowerCase() as "person" | "team"];
                        return (
                            <Link href={entity.href(organization.slug, row.id)}>{row.name}</Link>
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("deletedAt", {
                    header: "Deleted",
                    cell: (ctx) => {
                        const value = ctx.getValue();
                        return value ? (
                            formatRelativeDateTime(value)
                        ) : (
                            <span className="text-muted-foreground">&mdash;</span>
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.display({
                    id: "restore",
                    header: "",
                    cell: (ctx) => <RestoreCell row={ctx.row.original} />,
                    enableHiding: false,
                }),
            ]),
        [organization.slug, formatRelativeDateTime],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        columns,
        data: rows,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "deletedAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Trash</Saratoga.Title>
                <Saratoga.Actions></Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
