/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/d4h-views/equipment/categories
 */
"use client";

import { useMemo } from "react";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HMembersCollection } from "@/lib/collections/d4h-members";
import * as Paths from "@/paths";

export default function D4HViewsModule_Members_Page(
    props: PageProps<"/main/[slug]/d4h-views/members">,
) {
    const organization = useOrganization();

    const { data: members } = useLiveSuspenseQuery((q) =>
        q.from({
            member: getD4HMembersCollection(organization.id),
        }),
    );

    const columns = useMemo(
        () =>
            Akagi.defineColumns<(typeof members)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} align="center">
                            Member ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} align="center">
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Name
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.main(
                                    organization.slug,
                                ).d4HViews.member(
                                    ctx.row.original.team.id,
                                    ctx.row.original.id,
                                )}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("team.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Team
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(organization.slug).d4HViews.index,
                    Paths.main(organization.slug).d4HViews.members,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.main(organization.slug).d4HViews.index}
                        />
                        <Hermes.Title>Members</Hermes.Title>
                        <Hermes.Search>
                            <Akagi.TableSearch table={table} />
                        </Hermes.Search>
                    </Hermes.Header>
                    <Akagi.Table table={table} />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
