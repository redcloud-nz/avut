/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories/[category_id]
 */
"use client";

import { CornerDownRightIcon } from "lucide-react";
import { use, useMemo } from "react";

import { eq, useLiveQuery, useLiveSuspenseQuery } from "@tanstack/react-db";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentCategoriesCollection } from "@/lib/collections/d4h-equipment-categories";
import { getD4HEquipmentItemsCollection } from "@/lib/collections/d4h-equipment-items";
import * as Paths from "@/paths";

export default function D4HViewsModule_EquipmentItem_Page(
    props: PageProps<"/orgs/[slug]/d4h-views/equipment/items/[item_id]">,
) {
    const { item_id } = use(props.params);
    const itemId = parseInt(item_id, 10);

    const organization = useOrganization();

    const { data: item } = useLiveSuspenseQuery((q) =>
        q
            .from({
                item: getD4HEquipmentItemsCollection(organization.id),
            })
            .join(
                {
                    category: getD4HEquipmentCategoriesCollection(
                        organization.id,
                    ),
                },
                ({ item, category }) => eq(item.category.id, category.id),
            )
            .where(({ item }) => eq(item.id, itemId))
            .select(({ item, category }) => ({ ...item, category }))
            .findOne(),
    );
    const { data: contents = [], isReady: isContentsReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    item: getD4HEquipmentItemsCollection(organization.id),
                })
                .where(({ item }) => eq(item.parentId, itemId)),
        [organization.id, itemId],
    );

    if (!item) throw new Error(`EquipmentItem(${itemId}) not found`);

    const columns = useMemo(
        () =>
            Akagi.defineColumns<(typeof contents)[number]>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Ref
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
        data: contents,
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
                    Paths.org(organization.slug).d4hViews.index,
                    Paths.org(organization.slug).d4hViews.equipment.index,
                    Paths.org(organization.slug).d4hViews.equipment.items,
                    item.ref,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={
                                Paths.org(organization.slug).d4hViews.equipment
                                    .categories
                            }
                        />
                        <Hermes.Title>{item.ref}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Item Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Item ID</FieldLabel>
                                    <FieldValue value={item.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Reference</FieldLabel>
                                    <FieldValue value={item.ref} format="id" />
                                </Field>
                                {item.category && (
                                    <Field orientation="responsive">
                                        <FieldLabel>Category</FieldLabel>
                                        <FieldValue>
                                            <Link
                                                to={Paths.org(
                                                    organization.slug,
                                                ).d4hViews.equipment.category(
                                                    item.category.id,
                                                )}
                                            >
                                                {item.category.title}
                                            </Link>
                                        </FieldValue>
                                    </Field>
                                )}

                                <Field orientation="responsive">
                                    <FieldLabel>Kind</FieldLabel>
                                    <FieldValue value={item.kind.title} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Brand</FieldLabel>
                                    <FieldValue
                                        value={item.brand?.title ?? ""}
                                    />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Model</FieldLabel>
                                    <FieldValue
                                        value={item.model?.title ?? ""}
                                    />
                                </Field>

                                <Field orientation="responsive">
                                    <FieldLabel>Parents</FieldLabel>
                                    <div className="min-w-1/2 flex flex-col px-2.5">
                                        {item.parents.map((parent, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    paddingLeft: `${index * 1.5}rem`,
                                                }}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {index > 0 && (
                                                        <CornerDownRightIcon className="size-4 text-muted-foreground" />
                                                    )}
                                                    <div className="pt-1">
                                                        <Link
                                                            to={Paths.org(
                                                                organization.slug,
                                                            ).d4hViews.equipment.item(
                                                                parent.id,
                                                            )}
                                                        >
                                                            {parent.ref}
                                                        </Link>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={item.status} />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between mt-4">
                        <div className="text-lg font-semibold">Contents</div>
                        <Akagi.TableSearch table={table} />
                    </div>
                    <Show
                        when={isContentsReady}
                        fallback={<Skeleton className="w-full h-10" />}
                    >
                        <Akagi.Table table={table} />
                    </Show>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
