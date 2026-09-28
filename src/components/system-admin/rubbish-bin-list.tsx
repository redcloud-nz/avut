/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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

import { systemAdminEffects } from "@/client/system-admin-effects";
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
import { usePreferences } from "@/hooks/use-preferences";
import { USER_RETENTION_DAYS } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type DeletedUserRow = RouterOutput["systemAdmin"]["listDeletedUsers"][number];

function RecoverButton({ row }: { row: DeletedUserRow }) {
    const mutation = useMutation(
        trpc.systemAdmin.recoverUser.mutationOptions({
            meta: { effects: systemAdminEffects.recoverUser },
            onError(error) {
                toast.error(`Failed to recover account: ${error.message}`);
            },
            onSuccess() {
                toast.success(`Account "${row.name}" recovered from rubbish.`);
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
            onClick={() => mutation.mutate({ userId: row.id })}
        />
    );
}

function PurgeUserDialog({
    row,
    open,
    onOpenChange,
}: {
    row: DeletedUserRow | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const mutation = useMutation(
        trpc.systemAdmin.purgeUser.mutationOptions({
            meta: { effects: systemAdminEffects.purgeUser },
            onError(error) {
                toast.error(`Failed to delete account forever: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Account <ObjectName>{row?.name}</ObjectName> permanently deleted.
                    </>,
                );
                onOpenChange(false);
            },
        }),
    );

    return (
        <AlertDialog open={open && row !== undefined} onOpenChange={onOpenChange}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Forever</AlertDialogTitle>
                    <AlertDialogDescription>
                        Permanently delete the account <ObjectName>{row?.name}</ObjectName> (
                        {row?.email}) with its credentials, organisation memberships, D4H access
                        tokens and notes. Its actions in the audit log are kept. This can&rsquo;t be
                        undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Delete forever", pending: "Deleting", success: "Deleted" }}
                        onClick={() => row && mutation.mutate({ userId: row.id })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/**
 * The system Rubbish bin (#298): accounts deleted by an administrator or closed by their owner,
 * each purged a fixed `USER_RETENTION_DAYS` after deletion. Organisations join this list with
 * #297.
 */
export function SystemAdmin_RubbishBin_List() {
    const { formatRelativeDateTime } = usePreferences();
    const { data: rows } = useSuspenseQuery(trpc.systemAdmin.listDeletedUsers.queryOptions());

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
            Kaga.defineColumns<DeletedUserRow>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Account",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("email", {
                    header: "Email",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: true,
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
        [formatRelativeDateTime],
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
            </Saratoga.Header>
            <p className="text-muted-foreground text-sm">
                Deleted and closed accounts. Each is permanently deleted {USER_RETENTION_DAYS} days
                after it was deleted.
            </p>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
            <PurgeUserDialog
                row={purgeRow}
                open={action === "purge"}
                onOpenChange={(open) => {
                    if (!open) setPurgeTarget(null);
                }}
            />
        </Saratoga.Root>
    );
}
