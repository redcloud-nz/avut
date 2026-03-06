/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-ppe/templates
 */
"use client";

import { use, useMemo, useState } from "react";

import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty";
import { Show } from "@/components/show";

import { useOrganization } from "@/hooks/use-organization";
import { I3Template } from "@/lib/schemas/i3-template";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { I3Module_CreateTemplate_D4H_Dialog } from "./create-template-d4h";

export default function I3Module_Templates_Page(
    props: PageProps<"/orgs/[slug]/i3/templates">,
) {
    const { slug } = use(props.params);
    const organization = useOrganization();

    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const [{ data: templates }] = useSuspenseQueries({
        queries: [
            trpc.i3.listTemplates.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    type RowData = I3Template;

    const columns = useMemo(
        () =>
            Akagi.defineColumns<RowData>((col) => [
                col.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Name
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(slug).i3.template(
                                    ctx.row.original.id,
                                )}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                }),
                col.accessor("d4h", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            D4H Category
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.row.original.d4h ? (
                                <>
                                    {ctx.row.original.d4h.categoryTitle} &gt;{" "}
                                    {ctx.row.original.d4h.kindTitle}
                                </>
                            ) : (
                                ""
                            )}
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),

                col.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            className="w-24"
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
            ]),
        [slug],
    );

    const table = useReactTable({
        data: templates,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <>
            <Lexington.Root>
                <Lexington.Header
                    breadcrumbs={[
                        Paths.org(slug).i3.index,
                        Paths.org(slug).i3.templates,
                    ]}
                />
                <Lexington.Page>
                    <Lexington.Column width="xl">
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.org(slug).i3.index}
                                tooltip="Back to D4H PPE"
                            />
                            <Hermes.Title>PPE Templates</Hermes.Title>
                            <Hermes.Action>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ i3Template: ["create"] }}
                                >
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setCreateDialogOpen(true)
                                        }
                                    >
                                        <CreateNewIcon /> New
                                    </Button>
                                </Protect>
                            </Hermes.Action>
                        </Hermes.Header>
                        <Show
                            when={templates.length > 0}
                            fallback={
                                <Empty>
                                    <EmptyHeader>
                                        <EmptyTitle>
                                            No templates yet.
                                        </EmptyTitle>
                                        <EmptyDescription>
                                            Create a PPE template to define
                                            equipment that can be issued.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    <EmptyContent>
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{
                                                i3Template: ["create"],
                                            }}
                                        >
                                            <Button
                                                onClick={() =>
                                                    setCreateDialogOpen(true)
                                                }
                                            >
                                                Create Template
                                            </Button>
                                        </Protect>
                                    </EmptyContent>
                                </Empty>
                            }
                        >
                            <div className="flex items-center justify-between">
                                <Akagi.TableSearch table={table} />
                            </div>
                            <Akagi.Table table={table} />
                        </Show>
                    </Lexington.Column>
                </Lexington.Page>
            </Lexington.Root>

            <I3Module_CreateTemplate_D4H_Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />
        </>
    );
}
