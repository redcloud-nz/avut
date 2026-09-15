/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * "Show query" dialog for a Kaga table, kept out of kaga.tsx so the table/toolbar/header
 * components don't need to know anything about pseudo-query building — Kaga.TableToolbar's
 * `query` prop just takes a rendered <TablePseudoQuery .../> and clones it with
 * `open`/`onOpenChange` to wire it to its own menu item.
 */
"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { RowData, Table as TanstackTable } from "@tanstack/react-table";

import { getColumnDisplayName } from "@/components/blocks/kaga";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/**
 * Describes the real query behind a table well enough to render a readable
 * approximation of it — table, any joins (just naming the join table and the
 * field it joins on, not a full ON predicate — this is a pseudo query, not
 * real SQL), and any fixed condition the interactive state doesn't capture
 * (e.g. a route param scoping the query). Columns are named after each
 * column's `header` — a display label stand-in, not a real field name — so
 * there's no column-to-table mapping to configure.
 */
export type TablePseudoQueryConfig = {
    table: string;
    joins?: readonly { table: string; on: string }[];
    /** Literal conditions always applied, e.g. a route param — appended after the interactive filters. */
    extraWhere?: readonly string[];
};

/**
 * A pseudo-SQL rendering of the table's current sort/filter/search/pagination
 * state against the real table/join shape described by `query` — a readable
 * approximation, not a real, executable query. Columns are named after each
 * column's `header` (a display label stand-in, not a real field name), unqualified.
 */
function buildPseudoQuery<TData extends RowData>(
    table: TanstackTable<TData>,
    query: TablePseudoQueryConfig,
): string {
    const state = table.getState();
    const whereClauses: string[] = [];

    function columnName(id: string): string {
        const column = table.getColumn(id);
        return column ? getColumnDisplayName(column.columnDef) : id;
    }

    const globalFilter = state.globalFilter as string | undefined;
    if (globalFilter) {
        const escaped = globalFilter.replace(/'/g, "''");
        const searchableColumns = table
            .getAllColumns()
            .filter((column) => column.getCanGlobalFilter());
        const clause = searchableColumns
            .map((column) => `${getColumnDisplayName(column.columnDef)} ILIKE '%${escaped}%'`)
            .join(" OR ");
        if (searchableColumns.length > 0) {
            whereClauses.push(searchableColumns.length > 1 ? `(${clause})` : clause);
        }
    }

    for (const filter of state.columnFilters) {
        const values = (Array.isArray(filter.value) ? filter.value : [filter.value]) as unknown[];
        const formatted = values
            .map((value) => `'${String(value).replace(/'/g, "''")}'`)
            .join(", ");
        whereClauses.push(`${columnName(filter.id)} IN (${formatted})`);
    }

    whereClauses.push(...(query.extraWhere ?? []));

    const selectColumns = table
        .getVisibleLeafColumns()
        .filter((column) => column.accessorFn)
        .map((column) => getColumnDisplayName(column.columnDef));

    const lines = [
        `SELECT ${selectColumns.length > 0 ? selectColumns.join(", ") : "*"}`,
        `  FROM ${query.table}`,
        ...(query.joins ?? []).map((join) => `  JOIN ${join.table} ON ${join.on}`),
    ];
    if (whereClauses.length > 0) {
        lines.push(` WHERE ${whereClauses.join("\n   AND ")}`);
    }
    if (state.sorting.length > 0) {
        const clause = state.sorting
            .map((s) => `${columnName(s.id)} ${s.desc ? "DESC" : "ASC"}`)
            .join(", ");
        lines.push(` ORDER BY ${clause}`);
    }
    lines.push(
        ` LIMIT ${state.pagination.pageSize} OFFSET ${state.pagination.pageIndex * state.pagination.pageSize}`,
    );

    return lines.join("\n");
}

export function TablePseudoQuery<TData extends RowData>({
    table,
    config,
    open,
    onOpenChange,
}: {
    table: TanstackTable<TData>;
    config: TablePseudoQueryConfig;
    /** Injected by Kaga.TableToolbar via cloneElement — leave unset when used standalone. */
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [copied, setCopied] = useState(false);
    const queryText = buildPseudoQuery(table, config);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange?.(next);
                if (!next) setCopied(false);
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Query</DialogTitle>
                    <DialogDescription>
                        A rough approximation of the current sort, filter and search state — not the
                        real query behind this table.
                    </DialogDescription>
                </DialogHeader>
                <div className="relative">
                    <pre className="overflow-x-auto font-mono rounded-md bg-muted p-3 pr-10 text-xs leading-relaxed">
                        <code>{queryText}</code>
                    </pre>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="absolute top-1.5 right-1.5"
                        aria-label="Copy query"
                        onClick={() => {
                            void navigator.clipboard
                                ?.writeText(queryText)
                                .then(() => setCopied(true));
                        }}
                    >
                        {copied ? (
                            <CheckIcon className="size-4" />
                        ) : (
                            <CopyIcon className="size-4" />
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
