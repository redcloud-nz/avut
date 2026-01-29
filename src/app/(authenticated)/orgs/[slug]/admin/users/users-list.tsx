/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { SendIcon } from "lucide-react";
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
import { Protect } from "@/components/protect";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Item,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/items";
import { Link } from "@/components/ui/link";

import { formatDate } from "@/lib/datetime";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationMemberData } from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";
import { getUserInitials } from "@/lib/utils";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

type AdminModule_UsersListProps = {
    organization: OrganizationData;
    currentUserId: string;
};

export function AdminModule_UsersList({
    organization,
    currentUserId,
}: AdminModule_UsersListProps) {
    const { data: members } = useSuspenseQuery(
        trpc.organizations.listOrganizationMembers.queryOptions({
            organizationId: organization.id,
        }),
    );

    const adminModule = Paths.org(organization.slug).admin;

    type RowData = OrganizationMemberData & { user: UserData };

    const columns = useMemo(
        () =>
            Akagi.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("user.name", {
                    id: "name",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            User
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Item className="p-0" asChild>
                                <Link
                                    to={adminModule.user(ctx.row.original.id)}
                                >
                                    <ItemMedia>
                                        <Avatar>
                                            <AvatarImage
                                                src={
                                                    ctx.row.original.user
                                                        .image ?? undefined
                                                }
                                                alt="User Avatar"
                                            />
                                            <AvatarFallback>
                                                {getUserInitials(
                                                    ctx.row.original.user.name,
                                                )}
                                            </AvatarFallback>
                                        </Avatar>
                                    </ItemMedia>
                                    <ItemContent>
                                        <ItemTitle>
                                            {ctx.getValue()}
                                            {ctx.row.original.userId ===
                                            currentUserId ? (
                                                <span className="bg-neutral-200 border border-neutral-300 text-xs px-1.5 rounded-sm">
                                                    You
                                                </span>
                                            ) : null}
                                        </ItemTitle>
                                        <ItemDescription>
                                            {ctx.row.original.user.email}
                                        </ItemDescription>
                                    </ItemContent>
                                </Link>
                            </Item>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("createdAt", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Joined
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {formatDate(ctx.getValue())}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("role", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Role
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
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

    return (
        <Hermes.Section>
            <Hermes.SectionHeader>
                <Akagi.TableSearch table={table} />
                <Protect
                    orgId={organization.id}
                    permissions={{ invitation: ["create"] }}
                >
                    <Button variant="outline" asChild>
                        <Link to={adminModule.invitations.create}>
                            <SendIcon /> Invite
                        </Link>
                    </Button>
                </Protect>
            </Hermes.SectionHeader>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
