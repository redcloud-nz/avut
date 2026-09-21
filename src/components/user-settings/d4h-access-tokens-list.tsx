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
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Badge } from "@/components/ui/badge";
import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_AddD4HAccessToken_Dialog } from "./add-d4h-access-token-dialog";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

export function UserSettings_D4HAccessTokensList() {
    const { data: tokens } = useSuspenseQuery(
        trpc.d4hAccessTokens.listPersonalAccessTokens.queryOptions(),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<PersonalAccessToken>((columnHelper) => [
                columnHelper.accessor((row) => row.id, {
                    id: "id",
                    header: "ID",
                    cell: (ctx) => (
                        <Link
                            href={route("/user/settings/d4h/access-tokens/[token_id]", {
                                token_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.organization.name, {
                    id: "organization",
                    header: "Organisation",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("serverCode", {
                    header: "Server",
                    cell: (ctx) => getD4HServer(ctx.getValue())?.name,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => <Badge variant="outline">{ctx.getValue()}</Badge>,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("createdAt", {
                    header: "Created",
                    cell: (ctx) => new Date(ctx.getValue()).toLocaleDateString(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: tokens,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>D4H</Saratoga.Title>
                <Saratoga.Actions>
                    <UserSettings_AddD4HAccessToken_Dialog />
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
            </div>
        </Saratoga.Root>
    );
}
