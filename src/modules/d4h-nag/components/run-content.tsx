/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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
import { TeamLink } from "@/components/entity-links/team-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { Spinner } from "@/components/ui/spinner";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import type {
    D4HNagOutcome,
    D4HNagRecipientItem,
    D4HNagRunDetail,
    D4HNagRunId,
} from "@/lib/schemas/d4h-nag";
import { trpc } from "@/trpc/client";

import { describeRunTrigger } from "./runs-table";

/** How often the page refetches while the run is still `Running`. */
const RUNNING_REFETCH_MS = 3000;

/**
 * A recipient's outcome in words. `Pending` means "send in progress" while the run is running, and
 * "sent, unconfirmed" once it has finished: the email went out but recording it failed.
 */
function describeOutcome(outcome: D4HNagOutcome, running: boolean): string {
    switch (outcome) {
        case "Pending":
            return running ? "Sending…" : "Sent, unconfirmed";
        case "Sent":
            return "Sent";
        case "Failed":
            return "Failed";
        case "SkippedNoEmail":
            return "Skipped: no email";
        case "SkippedOptedOut":
            return "Skipped: opted out";
        case "SkippedAlreadyReminded":
            return "Skipped: already reminded";
        case "DryRun":
            return "Would send";
    }
}

const OUTCOMES: D4HNagOutcome[] = [
    "Sent",
    "Pending",
    "Failed",
    "DryRun",
    "SkippedNoEmail",
    "SkippedOptedOut",
    "SkippedAlreadyReminded",
];

/**
 * One run: its window, trigger, status and rule, and every recipient it considered. While the run
 * is in progress (Run now and Dry run finish in the background) the page refetches until it ends.
 */
export function D4HNag_Run_Content({ runId }: { runId: D4HNagRunId }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const { formatDateTime } = usePreferences();

    const { data: run } = useSuspenseQuery(
        trpc.d4hNag.getRun.queryOptions(
            { organizationId: organization.id, runId },
            {
                refetchInterval: (query) =>
                    query.state.data?.status === "Running" ? RUNNING_REFETCH_MS : false,
            },
        ),
    );

    const running = run.status === "Running";

    // The runs table and the rules list cache the run as `Running`; refresh them once it ends.
    const wasRunning = useRef(running);
    useEffect(() => {
        if (wasRunning.current && !running) {
            void queryClient.invalidateQueries(
                trpc.d4hNag.listRuns.queryFilter({ organizationId: organization.id }),
            );
            void queryClient.invalidateQueries(
                trpc.d4hNag.listRules.queryFilter({ organizationId: organization.id }),
            );
        }
        wasRunning.current = running;
    }, [running, queryClient, organization.id]);

    const title = `${run.dryRun ? "Dry Run" : "Run"}: ${run.teamName}`;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Attendance Reminders",
                        href: route("/orgs/[slug]/d4h-nag", { slug: organization.slug }),
                    },
                    {
                        label: "Rules",
                        href: route("/orgs/[slug]/d4h-nag", { slug: organization.slug }),
                    },
                    run.ruleId
                        ? {
                              label: run.teamName,
                              href: route("/orgs/[slug]/d4h-nag/rules/[rule_id]", {
                                  slug: organization.slug,
                                  rule_id: run.ruleId,
                              }),
                          }
                        : { label: "Deleted rule" },
                    { label: `${run.dryRun ? "Dry Run" : "Run"} ${formatDateTime(run.startedAt)}` },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{title}</Saratoga.Title>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <RunDetails_Card run={run} />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <RunStatus_Alert run={run} />
                            <RunCounts_Card run={run} />
                        </Saratoga.Column>
                    </Saratoga.Columns>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recipients</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Recipients_Table run={run} />
                        </CardContent>
                    </Card>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

function RunDetails_Card({ run }: { run: D4HNagRunDetail }) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    return (
        <Card>
            <CardHeader>
                <CardTitle>Run Details</CardTitle>
            </CardHeader>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>Rule</DataItemTitle>
                        <DataItemValue>
                            {run.ruleId ? (
                                <Link
                                    href={route("/orgs/[slug]/d4h-nag/rules/[rule_id]", {
                                        slug: organization.slug,
                                        rule_id: run.ruleId,
                                    })}
                                    className="hover:underline"
                                >
                                    Rule for {run.teamName}
                                </Link>
                            ) : (
                                <span className="text-muted-foreground">Deleted rule</span>
                            )}
                        </DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Team</DataItemTitle>
                        <DataItemValue>
                            <TeamLink team={{ id: run.teamId, name: run.teamName }} />
                        </DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Window</DataItemTitle>
                        <DataItemValue>
                            {formatDateTime(run.windowStart)} to {formatDateTime(run.windowEnd)}
                        </DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Trigger</DataItemTitle>
                        <DataItemValue>
                            {describeRunTrigger(run.trigger)}
                            {run.startedBy && (
                                <span className="text-muted-foreground">
                                    {" "}
                                    by {run.startedBy.name}
                                </span>
                            )}
                        </DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Dry Run</DataItemTitle>
                        <DataItemValue>{run.dryRun ? "Yes: nothing was sent" : "No"}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Started</DataItemTitle>
                        <DataItemDateValue date={run.startedAt} />
                    </DataItem>
                    {run.completedAt && (
                        <DataItem inline>
                            <DataItemTitle>Finished</DataItemTitle>
                            <DataItemDateValue date={run.completedAt} />
                        </DataItem>
                    )}
                </DataList>
            </CardContent>
        </Card>
    );
}

function RunStatus_Alert({ run }: { run: D4HNagRunDetail }) {
    if (run.status === "Running") {
        return (
            <Alert icon={<Spinner />}>
                <AlertTitle>In progress</AlertTitle>
                <AlertDescription>
                    {run.dryRun
                        ? "Checking who would be reminded. This page updates when it finishes."
                        : "Sending reminders. This page updates when it finishes."}
                </AlertDescription>
            </Alert>
        );
    }
    if (run.status === "Failed") {
        return (
            <Alert variant="error">
                <AlertTitle>Failed</AlertTitle>
                <AlertDescription>{run.error ?? "The run failed."}</AlertDescription>
            </Alert>
        );
    }
    return (
        <Alert variant="success">
            <AlertTitle>Completed</AlertTitle>
        </Alert>
    );
}

function RunCounts_Card({ run }: { run: D4HNagRunDetail }) {
    return (
        <Card>
            <CardContent>
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>Exercises</DataItemTitle>
                        <DataItemValue>{run.exercisesFound}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        {/* A dry run counts the reminders it would have sent (its `DryRun` rows). */}
                        <DataItemTitle>{run.dryRun ? "Would Send" : "Sent"}</DataItemTitle>
                        <DataItemValue>{run.sentCount}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Skipped</DataItemTitle>
                        <DataItemValue>{run.skippedCount}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Failed</DataItemTitle>
                        <DataItemValue>{run.failedCount}</DataItemValue>
                    </DataItem>
                </DataList>
            </CardContent>
        </Card>
    );
}

/** The run's recipients, filterable by exercise and outcome. */
function Recipients_Table({ run }: { run: D4HNagRunDetail }) {
    const { formatDateTime } = usePreferences();
    const running = run.status === "Running";

    const exerciseOptions = useMemo(() => {
        const seen = new Map<number, string>();
        for (const recipient of run.recipients) {
            if (!seen.has(recipient.d4hExerciseId)) {
                seen.set(
                    recipient.d4hExerciseId,
                    `${recipient.exerciseTitle} (${formatDateTime(recipient.exerciseStartsAt)})`,
                );
            }
        }
        return [...seen].map(([value, label]) => ({ value, label }));
    }, [run.recipients, formatDateTime]);

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HNagRecipientItem>((columnHelper) => [
                columnHelper.accessor("d4hExerciseId", {
                    header: "Exercise",
                    cell: (ctx) => ctx.row.original.exerciseTitle,
                    sortingFn: (a, b) =>
                        a.original.exerciseTitle.localeCompare(b.original.exerciseTitle),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: { columnOptions: exerciseOptions },
                }),
                columnHelper.accessor("exerciseStartsAt", {
                    header: "Starts",
                    cell: (ctx) => formatDateTime(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("memberName", {
                    header: "Member",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("email", {
                    header: "Email",
                    cell: (ctx) =>
                        ctx.getValue() ?? <span className="text-muted-foreground">None</span>,
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("outcome", {
                    header: "Outcome",
                    cell: (ctx) => {
                        const outcome = ctx.getValue();
                        const label = describeOutcome(outcome, running);
                        if (outcome === "Failed") {
                            return <span className="text-destructive">{label}</span>;
                        }
                        if (outcome.startsWith("Skipped")) {
                            return <span className="text-muted-foreground">{label}</span>;
                        }
                        return label;
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: OUTCOMES.filter((outcome) =>
                            run.recipients.some((recipient) => recipient.outcome === outcome),
                        ).map((outcome) => ({
                            value: outcome,
                            label: describeOutcome(outcome, running),
                        })),
                    },
                }),
            ]),
        [exerciseOptions, formatDateTime, running, run.recipients],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: run.recipients,
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
        <div>
            <Kaga.TableToolbar table={table} />
            <Kaga.Table table={table} />
            <Kaga.TablePagination table={table} />
        </div>
    );
}
