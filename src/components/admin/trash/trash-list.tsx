/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
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

import { trashEffects } from "@/client/trash-effects";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { TrashableEntities } from "@/lib/trash-registry";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type TrashRow = RouterOutput["trash"]["listTrash"][number];

/**
 * `listTrash` only returns rows the caller holds `delete` on, so every row here is one they can
 * recover or purge — no per-row permission check needed.
 */
function RecoverButton({ row }: { row: TrashRow }) {
    const organization = useOrganization();
    const label = TrashableEntities[row.type].label;

    const mutation = useMutation(
        trpc.trash.recoverRecord.mutationOptions({
            meta: { effects: trashEffects.recoverRecord },
            onError(error) {
                toast.error(`Failed to recover ${label.toLowerCase()}: ${error.message}`);
            },
            onSuccess() {
                toast.success(`${label} "${row.name}" recovered from rubbish.`);
            },
        }),
    );

    return (
        <MutationButton
            type="button"
            variant="outline"
            size="sm"
            status={mutation.status}
            text={{ idle: "Recover", pending: "Recovering", success: "Recovered" }}
            onClick={() =>
                mutation.mutate({ organizationId: organization.id, type: row.type, id: row.id })
            }
        />
    );
}

function PurgeDialog({
    row,
    open,
    onOpenChange,
}: {
    row: TrashRow;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const organization = useOrganization();
    const label = TrashableEntities[row.type].label;

    const mutation = useMutation(
        trpc.trash.purgeRecord.mutationOptions({
            meta: { effects: trashEffects.purgeRecord },
            onError(error) {
                toast.error(`Failed to delete ${label.toLowerCase()} forever: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        {label} <ObjectName>{row.name}</ObjectName> permanently deleted.
                    </>,
                );
                onOpenChange(false);
            },
        }),
    );

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Forever</AlertDialogTitle>
                    <AlertDialogDescription>
                        Permanently delete {label.toLowerCase()} <ObjectName>{row.name}</ObjectName>{" "}
                        and everything that belongs to it. This can&rsquo;t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Delete forever", pending: "Deleting", success: "Deleted" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                type: row.type,
                                id: row.id,
                            })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export function AdminModule_Trash_List() {
    const organization = useOrganization();
    const { formatRelativeDateTime } = usePreferences();

    const { data: rows } = useSuspenseQuery(
        trpc.trash.listTrash.queryOptions({ organizationId: organization.id }),
    );

    // `?action=purge&trashId=…` — the row is resolved from the list above.
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["purge"] as const));
    const [trashId, setTrashId] = useQueryState("trashId", parseAsString);
    const purgeRow = rows.find((row) => row.id === trashId);

    function setPurgeTarget(id: string | null) {
        const history = id ? "push" : "replace";
        void setAction(id ? "purge" : null, { history });
        void setTrashId(id, { history });
    }

    const columns = useMemo(
        () =>
            Kaga.defineColumns<TrashRow>((columnHelper) => [
                columnHelper.accessor("type", {
                    header: "Type",
                    cell: (ctx) => TrashableEntities[ctx.row.original.type].label,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    enableHiding: false,
                }),
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => {
                        const row = ctx.row.original;
                        const entity = TrashableEntities[row.type];
                        return entity.href ? (
                            <Link href={entity.href(organization.slug, row.id)}>{row.name}</Link>
                        ) : (
                            row.name
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
                columnHelper.accessor("purgeAt", {
                    header: "Purges",
                    cell: (ctx) => {
                        const value = ctx.getValue();
                        if (!value) {
                            // No Delete log entry, so no known date — never auto-purged.
                            return <span className="text-muted-foreground">Not scheduled</span>;
                        }
                        return new Date(value) <= new Date()
                            ? "Next purge run"
                            : formatRelativeDateTime(value);
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: true,
                }),
                columnHelper.display({
                    id: "actions",
                    header: "",
                    cell: (ctx) => (
                        <div className="flex justify-end gap-2">
                            <RecoverButton row={ctx.row.original} />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => setPurgeTarget(ctx.row.original.id)}
                            >
                                Delete forever
                            </Button>
                        </div>
                    ),
                    enableHiding: false,
                }),
            ]),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setPurgeTarget only closes over stable nuqs setters
        [organization.slug, formatRelativeDateTime],
    );

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
                <Saratoga.Title>Rubbish</Saratoga.Title>
                <Saratoga.Actions></Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
            {purgeRow && (
                <PurgeDialog
                    key={purgeRow.id}
                    row={purgeRow}
                    open={action === "purge"}
                    onOpenChange={(open) => {
                        if (!open) setPurgeTarget(null);
                    }}
                />
            )}
        </Saratoga.Root>
    );
}
