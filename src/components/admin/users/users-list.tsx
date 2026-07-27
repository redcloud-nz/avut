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
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { authClient } from "@/client/auth-client";
import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { type PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_Users_List() {
    const organization = useOrganization();

    const {
        data: { members },
    } = useSuspenseQuery({
        queryKey: ["auth", "organization-users", organization.id],
        queryFn: () =>
            authClient.organization.listMembers(
                { query: { organizationId: organization.id } },
                { throw: true },
            ),
    });

    const { data: personLinks } = useSuspenseQuery(
        trpc.users.listPersonLinks.queryOptions({ organizationId: organization.id }),
    );

    const personByUserId = useMemo(
        () => new Map<string, PersonData>(personLinks.map((link) => [link.userId, link.person])),
        [personLinks],
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof members)[0]>((columnHelper) => [
                columnHelper.accessor("user.name", {
                    id: "name",
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/admin/users/[user_id]", {
                                slug: organization.slug,
                                user_id: ctx.row.original.user.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("user.email", {
                    id: "email",
                    header: "Email",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor((row) => personByUserId.get(row.user.id)?.name ?? "", {
                    id: "person",
                    header: "Person",
                    cell: (ctx) => {
                        const person = personByUserId.get(ctx.row.original.user.id);

                        if (!person) return <span className="text-muted-foreground">&mdash;</span>;

                        return (
                            <Link
                                href={route("/orgs/[slug]/admin/personnel/[person_id]", {
                                    slug: organization.slug,
                                    person_id: person.id,
                                })}
                            >
                                {person.name}
                            </Link>
                        );
                    },
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
                }),
            ]),
        [organization.slug, personByUserId],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        columns,
        data: members,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Users</Saratoga.Title>
                <Saratoga.Actions></Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
