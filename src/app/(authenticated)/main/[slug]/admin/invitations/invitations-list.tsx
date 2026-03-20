/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { SendIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Protect } from "@/components/protect";
import { DeleteObjectIcon, DropdownMenuTriggerIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { authClient } from "@/client/auth-client";
import { formatDate } from "@/lib/datetime";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { trpc } from "@/trpc/client";

import { AdminModule_CreateInvitation_Dialog } from "./create-invitation";

type AdminModule_InvitationsListProps = { organization: OrganizationData };

export function AdminModule_InvitationsList({ organization }: AdminModule_InvitationsListProps) {
    const queryClient = useQueryClient();

    const { data: invitations } = useSuspenseQuery(
        trpc.organizations.listOrganizationInvitations.queryOptions({
            organizationId: organization.id,
        }),
    );

    const resendMutation = useMutation({
        mutationFn: async (invitation: OrganizationInvitationData) => {
            await authClient.organization.inviteMember({
                organizationId: organization.id,
                email: invitation.email,
                role: invitation.role,
                resend: true,
            });
        },
        onError(error) {
            console.error("Error resending invitation:", error);
            toast.error("Failed to resend invitation.");
        },
        onSuccess(_, invitation) {
            toast.success(`Invitation successfully resent to ${invitation.email}.`);
        },
    });

    const revokeMutation = useMutation({
        mutationFn: async (invitation: OrganizationInvitationData) => {
            await authClient.organization.cancelInvitation({
                invitationId: invitation.id,
            });
        },
        onError(error) {
            console.error("Error revoking invitation:", error);
            toast.error("Failed to revoke invitation.");
        },
        onSuccess(_, invitation) {
            toast.success(`Invitation successfully revoked for ${invitation.email}.`);
            queryClient.invalidateQueries(
                trpc.organizations.listOrganizationInvitations.queryFilter({
                    organizationId: organization.id,
                }),
            );
        },
    });

    const columns = useMemo(
        () =>
            Akagi.defineColumns<OrganizationInvitationData>((columnHelper) => [
                columnHelper.accessor("email", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Email Address</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("role", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Role</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue() === "org:admin" ? "Admin" : "Member"}
                        </Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("createdAt", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Sent</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {formatDate(ctx.getValue())}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={["pending", "accepted", "revoked", "expired"]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.row.original.status}</Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: "arrIncludesSome",
                }),
                columnHelper.display({
                    id: "actions",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} className="w-10">
                            Actions
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} className="text-center p-0">
                            {ctx.row.original.status == "pending" ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <DropdownMenuTriggerIcon />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuGroup>
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    resendMutation.mutate(ctx.row.original)
                                                }
                                            >
                                                <SendIcon />
                                                Resend
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    revokeMutation.mutate(ctx.row.original)
                                                }
                                                className="text-destructive"
                                            >
                                                <DeleteObjectIcon />
                                                Revoke
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <span className="text-muted-foreground">N/A</span>
                            )}
                        </Akagi.TableCell>
                    ),
                }),
            ]),
        [organization.slug],
    );

    const table = useReactTable<OrganizationInvitationData>({
        columns,
        data: invitations,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "createdAt", desc: true }],
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
                onOpenChange={setCreateDialogOpen}
            />
        </>
    );
}
