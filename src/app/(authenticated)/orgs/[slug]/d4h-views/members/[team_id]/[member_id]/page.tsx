/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/members/[member_id]
 */
"use client";

import { use, useMemo } from "react";

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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
import { Show } from "@/components/show";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { D4HEquipmentItem } from "@/lib/d4h-api/equipment-item";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

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
            Akagi.defineColumns<D4HEquipmentItem>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Ref
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(
                                    organization.slug,
                                ).d4HViews.equipment.item(ctx.row.original.id)}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("kind.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Kind
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
                columnHelper.accessor("model.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Model
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue() ?? ""}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={[
                                "OPERATIONAL",
                                "UNSERVICEABLE",
                                "RETIRED",
                            ]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    filterFn: "arrIncludesSome",
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableSorting: false,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [
                { id: "status", value: ["OPERATIONAL", "UNSERVICEABLE"] },
            ],
            pagination: {
                pageIndex: 0,
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(organization.slug).d4HViews.index,
                    Paths.org(organization.slug).d4HViews.members,
                    member.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={Paths.org(organization.slug).d4HViews.members}
                        />
                        <Hermes.Title>{member.name}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Member Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>ID</FieldLabel>
                                    <FieldValue value={member.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={member.name} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Email</FieldLabel>
                                    <FieldValue value={member.email.value} />
                                </Field>
                                {member.ref && (
                                    <Field orientation="responsive">
                                        <FieldLabel>Ref</FieldLabel>
                                        <FieldValue value={member.ref ?? ""} />
                                    </Field>
                                )}
                                {member.position && (
                                    <Field orientation="responsive">
                                        <FieldLabel>Position</FieldLabel>
                                        <FieldValue value={member.position} />
                                    </Field>
                                )}
                                <Field orientation="responsive">
                                    <FieldLabel>Team</FieldLabel>
                                    <FieldValue value={member.team.title} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={member.status} />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between mt-4">
                        <div className="text-lg font-semibold">
                            Issued Equipment
                        </div>
                    </div>
                    <Show
                        when={isSuccess}
                        fallback={<Skeleton className="w-full h-10" />}
                    >
                        <Akagi.Table table={table} />
                    </Show>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
