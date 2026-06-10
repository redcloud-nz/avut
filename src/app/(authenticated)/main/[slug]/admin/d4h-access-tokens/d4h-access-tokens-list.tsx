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
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";

import { Button } from "@/components/ui/button";

import { getD4HServer } from "@/lib/d4h-servers";
import { route } from "@/lib/routes";
import { D4HAccessToken } from "@/lib/schemas/d4h-access-token";
import { OrganizationData } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

interface AdminModule_D4hAccessTokensListProps {
    organization: OrganizationData;
}

export function AdminModule_D4hAccessTokensList({
    organization,
}: AdminModule_D4hAccessTokensListProps) {
    const { data: d4hAccessTokens } = useSuspenseQuery(
        trpc.d4hAccessTokens.listOrganizationAccessTokens.queryOptions({
            organizationId: organization.id,
        }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HAccessToken>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: "ID",
                    cell: (ctx) => (
                        <Link
                            href={route("/main/[slug]/admin/d4h-access-tokens/[token_id]", {
                                slug: organization.slug,
                                token_id: ctx.getValue(),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("label", {
                    header: "Label",
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
                columnHelper.accessor("createdAt", {
                    header: "Created At",
                    cell: (ctx) => new Date(ctx.getValue()).toLocaleString(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: d4hAccessTokens,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>D4H Access Tokens</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect orgId={organization.id} permissions={{ d4hAccessToken: ["create"] }}>
                        <Button variant="outline" asChild>
                            <Link
                                href={route("/main/[slug]/admin/d4h-access-tokens/--create", {
                                    slug: organization.slug,
                                })}
                            >
                                <CreateNewIcon /> New
                            </Link>
                        </Button>
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
            </div>
        </Saratoga.Root>
    );
}
