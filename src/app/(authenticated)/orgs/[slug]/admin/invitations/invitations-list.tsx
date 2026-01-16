/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { SendIcon } from "lucide-react";
import { useMemo } from "react";

import {
    QueryClient,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { DeleteObjectIcon, DropdownMenuTriggerIcon } from "@/components/icons";
import { S2_Button } from "@/components/ui/s2-button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/components/ui/link";

import { formatDate } from "@/lib/datetime";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { Protect } from "@/components/protect";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

type AdminModule_InvitationsListProps = { organization: OrganizationData };

export function AdminModule_InvitationsList({
    organization,
}: AdminModule_InvitationsListProps) {
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
            toast.success(
                `Invitation successfully resent to ${invitation.email}.`,
            );
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
            toast.success(
                `Invitation successfully revoked for ${invitation.email}.`,
            );
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
                        <Akagi.TableHeader header={ctx.header}>
                            Email Address
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("role", {
                    header: (ctx) => (
                        <Akagi.TableHeader header={ctx.header}>
                            Role
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue() === "org:admin"
                                ? "Admin"
                                : "Member"}
                        </Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("createdAt", {
                    header: (ctx) => (
                        <Akagi.TableHeader header={ctx.header}>
                            Sent
                        </Akagi.TableHeader>
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
                        <Akagi.TableHeader
                            header={ctx.header}
                            filterOptions={[
                                "pending",
                                "accepted",
                                "revoked",
                                "expired",
                            ]}
                        >
                            Status
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.row.original.status}
                        </Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: "arrIncludesSome",
                }),
                columnHelper.display({
                    id: "actions",
                    header: (ctx) => (
                        <Akagi.TableHeader header={ctx.header} className="w-10">
                            Actions
                        </Akagi.TableHeader>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell
                            cell={ctx.cell}
                            className="text-center"
                        >
                            {ctx.row.original.status == "pending" ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <S2_Button variant="ghost" size="icon">
                                            <DropdownMenuTriggerIcon />
                                        </S2_Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuGroup>
                                            <DropdownMenuLabel>
                                                Actions
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    resendMutation.mutate(
                                                        ctx.row.original,
                                                    )
                                                }
                                            >
                                                <SendIcon />
                                                Resend
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onSelect={() =>
                                                    revokeMutation.mutate(
                                                        ctx.row.original,
                                                    )
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
                                <span className="text-muted-foreground">
                                    N/A
                                </span>
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

    return (
        <Hermes.Section>
            <Hermes.SectionHeader>
                <Akagi.TableSearch table={table} />
                <Protect
                    orgId={organization.id}
                    permissions={{ invitation: ["create"] }}
                >
                    <S2_Button variant="outline" asChild>
                        <Link
                            to={
                                Paths.org(organization.slug).admin.invitations
                                    .create
                            }
                        >
                            <SendIcon /> Invite
                        </Link>
                    </S2_Button>
                </Protect>
            </Hermes.SectionHeader>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
