/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

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

import { organizationsEffects } from "@/client/organizations-effects";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Switch } from "@/components/ui/switch";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

const ROLE = "skills-assessor";

// Email doesn't fit beside the name and switch at phone width — hide it below `md`; it's still
// matched by the toolbar search.
const hideBelowMd = {
    headerProps: { className: "hidden md:table-cell" },
    cellProps: { className: "hidden md:table-cell" },
} as const;

/**
 * Every active member of the organization, with a switch to grant or revoke Skills Assessor —
 * the `roleGrant` surface for a Skills Admin, who can't reach the org-admin users pages. A member
 * who already holds a role covering Skills Assessor (e.g. Skills Admin), or for whom it is their
 * only role (revoking it would leave the membership empty), gets a note instead of a switch.
 */
export function SkillTrack_AssessorsList() {
    const organization = useOrganization();

    const { data: members } = useSuspenseQuery(
        trpc.organizations.listMembersForRoleGrant.queryOptions({
            organizationId: organization.id,
            role: ROLE,
        }),
    );

    const grantMutation = useMutation(
        trpc.organizations.grantMemberRole.mutationOptions({
            meta: { effects: organizationsEffects.grantMemberRole },
            onError(error) {
                toast.error(`Failed to grant Skills Assessor: ${error.message}`);
            },
        }),
    );
    const revokeMutation = useMutation(
        trpc.organizations.revokeMemberRole.mutationOptions({
            meta: { effects: organizationsEffects.revokeMemberRole },
            onError(error) {
                toast.error(`Failed to revoke Skills Assessor: ${error.message}`);
            },
        }),
    );

    type Row = (typeof members)[number];

    const pendingUserId =
        (grantMutation.isPending && grantMutation.variables?.userId) ||
        (revokeMutation.isPending && revokeMutation.variables?.userId) ||
        null;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Row>((col) => [
                col.accessor("name", {
                    header: "Name",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                col.accessor("email", {
                    header: "Email",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                    meta: hideBelowMd,
                }),
                col.accessor((row) => row.holdsRole || row.coveredBy != null, {
                    id: "assessor",
                    header: OrganizationRole.displayNames[ROLE],
                    cell: (ctx) => {
                        const row = ctx.row.original;
                        // A locked row shows why in place of the switch: the role covering it.
                        if (row.coveredBy) {
                            return (
                                <span className="text-sm text-muted-foreground">
                                    {OrganizationRole.displayNames[row.coveredBy]}
                                </span>
                            );
                        }
                        if (row.isOnlyRole) {
                            return (
                                <span className="text-sm text-muted-foreground">
                                    Their only role
                                </span>
                            );
                        }
                        return (
                            <Switch
                                aria-label={`${OrganizationRole.displayNames[ROLE]} for ${row.name}`}
                                checked={ctx.getValue()}
                                disabled={pendingUserId === row.userId}
                                onCheckedChange={(checked) => {
                                    const vars = {
                                        organizationId: organization.id,
                                        userId: row.userId,
                                        role: ROLE,
                                    } as const;
                                    if (checked) {
                                        grantMutation.mutate(vars, {
                                            onSuccess: () =>
                                                toast.success(
                                                    <>
                                                        <ObjectName>{row.name}</ObjectName> is now a
                                                        Skills Assessor.
                                                    </>,
                                                ),
                                        });
                                    } else {
                                        revokeMutation.mutate(vars, {
                                            onSuccess: () =>
                                                toast.success(
                                                    <>
                                                        <ObjectName>{row.name}</ObjectName> is no
                                                        longer a Skills Assessor.
                                                    </>,
                                                ),
                                        });
                                    }
                                }}
                            />
                        );
                    },
                    // Unsortable so the header can right-align over the switches — a sortable
                    // header renders as a full-width menu button. `pr-3` keeps the switch's
                    // hit area (`after:-inset-x-3`) inside the table, which would otherwise
                    // scroll sideways to reach it.
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                    meta: {
                        headerProps: { className: "text-right pr-3" },
                        cellProps: { className: "text-right pr-3" },
                    },
                }),
            ]),
        [organization.id, pendingUserId, grantMutation, revokeMutation],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Assessors</Saratoga.Title>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
