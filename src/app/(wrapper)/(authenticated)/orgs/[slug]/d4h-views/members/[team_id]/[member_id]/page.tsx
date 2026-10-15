/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/members/[member_id]
 */
"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Show } from "@/components/show";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentItem } from "@/lib/schemas/d4h/equipment-item";
import { trpc } from "@/trpc/client";

export default function D4HViewsModule_Member_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/members/[team_id]/[member_id]">,
) {
    const { team_id, member_id } = use(props.params);
    const teamId = parseInt(team_id, 10);
    const memberId = parseInt(member_id, 10);

    const organization = useOrganization();

    const { data: members } = useSuspenseQuery(
        trpc.d4hApi.listMembers.queryOptions({
            organizationId: organization.id,
        }),
    );
    const member = members.find((m) => m.id === memberId);
    if (!member) throw new Error("Member not found");

    const { data: items = [], isSuccess } = useQuery(
        trpc.d4hApi.listMemberEquipment.queryOptions({
            organizationId: organization.id,
            teamId,
            memberId,
        }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HEquipmentItem>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: "Ref",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h-views/equipment/items/[item_id]", {
                                slug: organization.slug,
                                item_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("kind.title", {
                    header: "Kind",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("model.title", {
                    header: "Model",
                    cell: (ctx) => ctx.getValue() ?? "",
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableSorting: false,
                    meta: {
                        columnOptions: [
                            { label: "OPERATIONAL", value: "OPERATIONAL" },
                            { label: "UNSERVICEABLE", value: "UNSERVICEABLE" },
                            { label: "RETIRED", value: "RETIRED" },
                        ],
                    },
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["OPERATIONAL", "UNSERVICEABLE"] }],
            pagination: {
                pageIndex: 0,
                pageSize: Kaga.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Views",
                        href: route("/orgs/[slug]/d4h-views", { slug: organization.slug }),
                    },
                    {
                        label: "Members",
                        href: route("/orgs/[slug]/d4h-views/members", { slug: organization.slug }),
                    },
                    member.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{member.name}</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Member Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <DataList>
                                <DataItem inline>
                                    <DataItemTitle>ID</DataItemTitle>
                                    <DataItemValue>{member.id}</DataItemValue>
                                </DataItem>
                                <DataItem inline>
                                    <DataItemTitle>Name</DataItemTitle>
                                    <DataItemValue>{member.name}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Email</DataItemTitle>
                                    <DataItemValue>{member.email.value}</DataItemValue>
                                </DataItem>
                                {member.ref && (
                                    <DataItem inline>
                                        <DataItemTitle>Ref</DataItemTitle>
                                        <DataItemValue>{member.ref}</DataItemValue>
                                    </DataItem>
                                )}
                                {member.position && (
                                    <DataItem inline>
                                        <DataItemTitle>Position</DataItemTitle>
                                        <DataItemValue>{member.position}</DataItemValue>
                                    </DataItem>
                                )}
                                <DataItem inline>
                                    <DataItemTitle>Team</DataItemTitle>
                                    <DataItemValue>{member.team.title}</DataItemValue>
                                </DataItem>
                                <DataItem inline>
                                    <DataItemTitle>Status</DataItemTitle>
                                    <DataItemValue>{member.status}</DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between mt-4">
                        <div className="text-lg font-semibold">Issued Equipment</div>
                    </div>
                    <Show when={isSuccess} fallback={<Skeleton className="w-full h-10" />}>
                        <Kaga.TableToolbar table={table} />
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </Show>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
