/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { SendIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { formatDate } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { trpc } from "@/trpc/client";

import { AdminModule_CreateInvitation_Dialog } from "../invitations/create-invitation";

type AdminModule_UsersListProps = {
    organization: OrganizationData;
    currentUserId: string;
};

export function AdminModule_UsersList({ organization, currentUserId }: AdminModule_UsersListProps) {
    const { data: members } = useSuspenseQuery(
        trpc.accessControl.listOrganizationUsers.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = OrganizationUser;

    const columns = useMemo(
        () =>
            Akagi.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    id: "name",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>User</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                href={route("/main/[slug]/admin/users/[user_id]", {
                                    slug: organization.slug,
                                    user_id: ctx.row.original.userId,
                                })}
                            >
                                {ctx.getValue()}
                                {ctx.row.original.userId === currentUserId ? (
                                    <span className="bg-neutral-200 border border-neutral-300 text-xs ml-1 px-1.5 rounded-sm">
                                        You
                                    </span>
                                ) : null}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("email", {
                    id: "email",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Email</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("createdAt", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Joined</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {formatDate(ctx.getValue())}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("roles", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Role</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.row.original.roles
                                .map((role) => OrganizationRole.displayNames[role])
                                .join(", ")}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                }),
            ]),
        [],
    );

    const table = useReactTable<RowData>({
        columns,
        data: members,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    return (
        <>
            <div className="flex items-center justify-between">
                <Akagi.TableSearch table={table} />
                <Protect orgId={organization.id} permissions={{ invitation: ["create"] }}>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                        <SendIcon /> Invite
                    </Button>
                </Protect>
            </div>
            <Akagi.Table table={table} />
            <AdminModule_CreateInvitation_Dialog
                open={createDialogOpen}
                onOpenChange={(open) => setCreateDialogOpen(open)}
            />
        </>
    );
}
