/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ClipboardCheckIcon } from "lucide-react";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { useDeferredValue, useMemo, type ReactNode } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { getCoreRowModel, useReactTable, type PaginationState } from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import { assessorDisplayName, getSkillCheckResultLabel } from "@/lib/schemas/skill-check";
import { cn } from "@/lib/utils";
import { SkillTrack_ChecksFilterBar } from "@/modules/skill-track/components/checks-filter-bar";
import { SkillTrack_CreateCheck_Dialog } from "@/modules/skill-track/components/create-check";
import {
    CHECK_SEARCH_PAGE_SIZE,
    checkSearchInput,
    checkSearchPage,
    checkSearchParsers,
} from "@/modules/skill-track/lib/check-search-params";
import { trpc } from "@/trpc/client";

/**
 * Every check in the organization, newest first, one server page at a time. The filters and page
 * live in search params (`check-search-params.ts`), so a filtered view can be linked to.
 */
export default function SkillTrack_ChecksList() {
    const organization = useOrganization();
    const { formatDate } = usePreferences();

    const [params, setParams] = useQueryStates(checkSearchParsers);

    // nuqs updates synchronously, so a new query key would suspend and fall back to the loading
    // page. Building the input from the deferred params keeps the old rows (and everything around
    // them) on screen until the new page arrives.
    const deferredParams = useDeferredValue(params);
    const input = checkSearchInput(organization.id, deferredParams);
    // A filter or page change is in flight while the live params ask for something else.
    const isPending =
        JSON.stringify(checkSearchInput(organization.id, params)) !== JSON.stringify(input);

    const {
        data: { rows, total },
    } = useSuspenseQuery(trpc.skillChecks.searchChecks.queryOptions(input));

    type Row = (typeof rows)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Row>((col) => [
                col.accessor((row) => row.assessee.name, {
                    id: "assessee",
                    header: "Assessee",
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.skill.name, {
                    id: "skill",
                    header: "Skill",
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
                col.accessor("result", {
                    header: "Result",
                    cell: (ctx) => getSkillCheckResultLabel(organization.settings, ctx.getValue()),
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => (row.session ? row.session.name || row.session.id : null), {
                    id: "session",
                    header: "Session",
                    cell: (ctx) => {
                        const row = ctx.row.original;
                        if (!row.session) return <span className="text-muted-foreground">—</span>;
                        const label = row.session.name || row.session.id;
                        return (
                            <Link
                                href={route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                                    slug: organization.slug,
                                    session_id: row.session.id,
                                })}
                            >
                                {label}
                            </Link>
                        );
                    },
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
                col.accessor("checkedAt", {
                    header: "Date",
                    cell: (ctx) => formatDate(ctx.getValue()),
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => assessorDisplayName(row), {
                    id: "assessor",
                    header: "Assessor",
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug, organization.settings, formatDate],
    );

    // From the live page, not the deferred one, so paging again before the next page arrives
    // steps on from where the user is rather than from what's on screen.
    const pagination: PaginationState = {
        pageIndex: checkSearchPage(params.page) - 1,
        pageSize: CHECK_SEARCH_PAGE_SIZE,
    };

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        rowCount: total,
        enableSorting: false,
        enableColumnFilters: false,
        state: { pagination },
        onPaginationChange: (updater) => {
            const next = typeof updater === "function" ? updater(pagination) : updater;
            void setParams({ page: next.pageIndex + 1 });
        },
    });

    const hasFilters = Object.keys(input.filters).length > 0;

    let results: ReactNode;
    if (total === 0) {
        results = (
            <ChecksEmpty>
                {hasFilters
                    ? "No skill checks match these filters."
                    : "No skill checks have been recorded yet."}
            </ChecksEmpty>
        );
    } else if (rows.length === 0) {
        // A page past the end, e.g. a hand-edited `?page=` or a link from before checks were removed.
        results = (
            <ChecksEmpty
                action={
                    <Button variant="link" onClick={() => void setParams({ page: null })}>
                        Go to the first page
                    </Button>
                }
            >
                There are no skill checks on this page.
            </ChecksEmpty>
        );
    } else {
        results = (
            <div>
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        );
    }

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skill Checks</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ skillCheck: ["create"], person: ["view"] }}>
                        <SkillTrack_CreateCheck_Dialog />
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <SkillTrack_ChecksFilterBar
                params={params}
                onFiltersChange={(update) =>
                    // Filters replace history (see `checkSearchParsers`); any change returns to
                    // page 1. `null` clears every param, page included.
                    void setParams(update && { ...update, page: null }, { history: "replace" })
                }
                sampleRow={rows[0]}
            />
            <div className={cn("transition-opacity", isPending && "opacity-60")}>{results}</div>
        </Saratoga.Root>
    );
}

function ChecksEmpty({ action, children }: { action?: ReactNode; children: ReactNode }) {
    return (
        <Empty>
            <EmptyMedia>
                <ClipboardCheckIcon className="size-12 text-muted-foreground" />
            </EmptyMedia>
            <EmptyDescription>{children}</EmptyDescription>
            {action && <EmptyContent>{action}</EmptyContent>}
        </Empty>
    );
}
