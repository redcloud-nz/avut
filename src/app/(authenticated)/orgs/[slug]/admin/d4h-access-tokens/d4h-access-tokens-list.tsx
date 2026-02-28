/*
 *  Copyright (c) 2026 A.V.U.T. Project.
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

import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";

import { D4HAccessToken } from "@/lib/schemas/d4h-access-token";
import { OrganizationData } from "@/lib/schemas/organization";

import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { getD4HServer } from "@/lib/d4h-api/servers";

interface AdminModule_D4hAccessTokensListProps {
    organization: OrganizationData;
}

/**
 * List of D4H access tokens in the organization.
 */
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
            Akagi.defineColumns<D4HAccessToken>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(
                                    organization.slug,
                                ).admin.d4hAccessToken(ctx.getValue())}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                }),
                columnHelper.accessor("label", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Label
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                }),
                columnHelper.accessor("serverCode", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Server
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {getD4HServer(ctx.getValue())?.name}
                        </Akagi.TableCell>
                    ),
                }),
                columnHelper.accessor("createdAt", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Created At
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {new Date(ctx.getValue()).toLocaleString()}
                        </Akagi.TableCell>
                    ),
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
        <Hermes.Section>
            <Hermes.Header>
                <Akagi.TableSearch table={table} />
                <Protect
                    orgId={organization.id}
                    permissions={{ d4hAccessToken: ["create"] }}
                >
                    <Button variant="outline" asChild>
                        <Link
                            to={
                                Paths.org(organization.slug).admin
                                    .d4hAccessTokens.create
                            }
                        >
                            <CreateNewIcon /> Access Token
                        </Link>
                    </Button>
                </Protect>
            </Hermes.Header>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
