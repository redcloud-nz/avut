/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { TeamLink } from "@/components/entity-links/team-link";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import type { D4HNagOptOutListItem, D4HNagOptOutSource } from "@/lib/schemas/d4h-nag";
import { trpc } from "@/trpc/client";

import { D4HNag_AddOptOut_Dialog } from "./add-opt-out-dialog";
import { D4HNag_RemoveOptOut_Dialog } from "./remove-opt-out-dialog";

const SOURCE_LABELS: Record<D4HNagOptOutSource, string> = {
    Self: "Member",
    Admin: "Admin",
};

/**
 * The members who've opted out of reminders, per team. Hosts the per-row remove dialog
 * (`?action=remove-opt-out&optOutId=…`); the add dialog owns its own param.
 */
export function D4HNag_OptOuts_List() {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const { data: optOuts } = useSuspenseQuery(
        trpc.d4hNag.listOptOuts.queryOptions({ organizationId: organization.id }),
    );

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["remove-opt-out"] as const),
    );
    const [optOutId, setOptOutId] = useQueryState("optOutId", parseAsString);
    const removeTarget = optOuts.find((optOut) => optOut.id === optOutId) ?? null;

    function setRemoveTarget(id: string | null) {
        const history = id ? "push" : "replace";
        void setAction(id ? "remove-opt-out" : null, { history });
        void setOptOutId(id, { history });
    }

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HNagOptOutListItem>((columnHelper) => [
                columnHelper.accessor((row) => row.team.name, {
                    id: "team",
                    header: "Team",
                    cell: (ctx) => <TeamLink team={ctx.row.original.team} />,
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("memberName", {
                    header: "Member",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("source", {
                    header: "Opted Out By",
                    cell: (ctx) => {
                        const { source, createdBy } = ctx.row.original;
                        return (
                            <>
                                {SOURCE_LABELS[source]}
                                {source === "Admin" && createdBy && (
                                    <span className="text-muted-foreground">
                                        {" "}
                                        ({createdBy.name})
                                    </span>
                                )}
                            </>
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: SOURCE_LABELS.Self, value: "Self" },
                            { label: SOURCE_LABELS.Admin, value: "Admin" },
                        ],
                    },
                }),
                columnHelper.accessor("createdAt", {
                    header: "When",
                    cell: (ctx) => formatDateTime(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.display({
                    id: "actions",
                    header: "",
                    cell: (ctx) => (
                        <Protect permissions={{ d4hNag: ["update"] }}>
                            <div className="flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() => setRemoveTarget(ctx.row.original.id)}
                                >
                                    Remove
                                </Button>
                            </div>
                        </Protect>
                    ),
                    enableHiding: false,
                }),
            ]),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- setRemoveTarget only closes over stable nuqs setters
        [formatDateTime],
    );

    const table = useReactTable({
        data: optOuts,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Opt-outs</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ d4hNag: ["update"] }}>
                        <D4HNag_AddOptOut_Dialog />
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <p className="text-sm text-muted-foreground">
                Members listed here get no reminders for the team, or for any other team linked to
                the same D4H team.
            </p>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>

            {removeTarget && (
                <D4HNag_RemoveOptOut_Dialog
                    optOut={removeTarget}
                    open={action === "remove-opt-out"}
                    onOpenChange={(open) => (open ? undefined : setRemoveTarget(null))}
                />
            )}
        </Saratoga.Root>
    );
}
