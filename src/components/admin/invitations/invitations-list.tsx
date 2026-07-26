/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { type InvitationStatus } from "better-auth/plugins";
import { CircleXIcon, SendIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { authClient } from "@/client/auth-client";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { formatDateTime } from "@/lib/datetime";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { useOrganization } from "@/hooks/use-organization";
import { type AuthInvitation } from "@/server/auth";

import { AdminModule_CreateInvitation_Dialog } from "./create-invitation";

export function AdminModule_Invitations_List() {
    const organization = useOrganization();

    const { data: invitations } = useSuspenseQuery({
        queryKey: ["auth", "organization-invitations", organization.id],
        queryFn: () =>
            authClient.organization.listInvitations(
                { query: { organizationId: organization.id } },
                { throw: true },
            ),
    });

    const columns = useMemo(
        () =>
            Kaga.defineColumns<AuthInvitation>((columnHelper) => [
                columnHelper.accessor("email", {
                    header: "Email",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("role", {
                    header: "Roles",
                    cell: (ctx) => OrganizationRole.formatList(ctx.getValue()),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    enableHiding: false,
                    filterFn: (row, columnId, filterValue: string[]) => {
                        const roles = (row.getValue(columnId) as string)
                            .split(",")
                            .map((role) => role.trim());
                        return filterValue.some((role) => roles.includes(role));
                    },
                    meta: {
                        columnOptions: OrganizationRole.options,
                    },
                }),
                columnHelper.accessor("createdAt", {
                    header: "Created",
                    cell: (ctx) => formatDateTime(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) =>
                        match(ctx.getValue())
                            .with("pending", () => (
                                <Badge className="bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                    Pending
                                </Badge>
                            ))
                            .with("accepted", () => (
                                <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                    Accepted
                                </Badge>
                            ))
                            .with("rejected", () => (
                                <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                                    Rejected
                                </Badge>
                            ))
                            .with("canceled", () => <Badge variant="secondary">Cancelled</Badge>),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    enableHiding: false,
                    filterFn: (row, columnId, filterValue: string[]) => {
                        const status = row.getValue(columnId) as InvitationStatus;

                        return filterValue.includes(status);
                    },
                    meta: {
                        columnOptions: [
                            { label: "Pending", value: "pending" },
                            { label: "Accepted", value: "accepted" },
                            { label: "Rejected", value: "rejected" },
                            { label: "Cancelled", value: "canceled" },
                        ],
                    },
                }),
                columnHelper.display({
                    id: "actions",
                    cell: (ctx) =>
                        ctx.row.original.status == "pending" ? (
                            <InvitationActions invitation={ctx.row.original} />
                        ) : null,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                    meta: {
                        cellProps: {
                            className: "w-8 p-0",
                        },
                    },
                }),
            ]),

        [],
    );

    const table = useReactTable({
        data: invitations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [
                { id: "role", value: OrganizationRole.values },
                { id: "status", value: ["pending", "accepted", "rejected", "canceled"] },
            ],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "createdAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Invitations</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect orgId={organization.id} permissions={{ invitation: ["create"] }}>
                        <AdminModule_CreateInvitation_Dialog />
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}

function InvitationActions({ invitation }: { invitation: AuthInvitation }) {
    const queryClient = useQueryClient();

    const resendMutation = useMutation({
        mutationFn: () =>
            authClient.organization.inviteMember(
                {
                    email: invitation.email,
                    role: invitation.role,
                    organizationId: invitation.organizationId,
                    resend: true,
                },
                { throw: true },
            ),
        onError: (error) => {
            toast.error(`Failed to resend invitation: ${error.message}`);
            console.error("Failed to resend invitation:", error);
        },
        onSuccess: (resentInvitation) => {
            toast.success(`Invitation resent to ${resentInvitation.email}`);

            queryClient.invalidateQueries({
                queryKey: ["auth", "organization-invitations", invitation.organizationId],
            });
        },
    });

    const revokeMutation = useMutation({
        mutationFn: () =>
            authClient.organization.cancelInvitation(
                {
                    invitationId: invitation.id,
                },
                { throw: true },
            ),
        onError: (error) => {
            toast.error(`Failed to revoke invitation: ${error.message}`);
            console.error("Failed to revoke invitation:", error);
        },
        onSuccess: () => {
            toast.success(`Invitation revoked for ${invitation.email}`);

            queryClient.invalidateQueries({
                queryKey: ["auth", "organization-invitations", invitation.organizationId],
            });
        },
    });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <Protect
                        orgId={invitation.organizationId}
                        permissions={{ invitation: ["create"] }}
                        render={(allowed) => (
                            <DropdownMenuItem
                                disabled={!allowed}
                                onClick={() => {
                                    if (allowed) {
                                        resendMutation.mutate();
                                    }
                                }}
                            >
                                <SendIcon /> Resend
                            </DropdownMenuItem>
                        )}
                    />
                    <Protect
                        orgId={invitation.organizationId}
                        permissions={{ invitation: ["cancel"] }}
                        render={(allowed) => (
                            <DropdownMenuItem
                                disabled={!allowed}
                                onClick={() => {
                                    if (allowed) {
                                        revokeMutation.mutate();
                                    }
                                }}
                                className="text-destructive"
                            >
                                <CircleXIcon /> Revoke
                            </DropdownMenuItem>
                        )}
                    />
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
