/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import { D4HTask } from "@/lib/schemas/d4h-task";
import { trpc } from "@/trpc/client";

import { D4HI3Module_D4HTaskActions } from "./d4h-task-actions";
import { D4HI3Module_D4HTaskChanges } from "./d4h-task-changes";

type OpenTaskRow = {
    task: D4HTask;
    requestedByName: string | null;
    d4hUrl: string;
    teamTitle: string;
};

/**
 * The open D4H tasks on every team where the viewer holds D4H's Equipment RETIRE permission,
 * grouped by team, each with Open in D4H, Check and Dismiss.
 */
export function D4HI3Module_D4HTasks_List() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: rows } = useSuspenseQuery(
        trpc.d4hTasks.listOpenTasks.queryOptions({ organizationId: organization.id }),
    );

    const groups = new Map<number, OpenTaskRow[]>();
    for (const row of rows) {
        const teamRows = groups.get(row.task.d4hTeamId);
        if (teamRows) teamRows.push(row);
        else groups.set(row.task.d4hTeamId, [row]);
    }

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H I3", href: route("/orgs/[slug]/d4h-i3", { slug }) },
                    { label: "D4H Tasks" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>D4H Tasks</Saratoga.Title>
                    </Saratoga.Header>
                    <p className="text-sm text-muted-foreground">
                        Changes the D4H API can&apos;t make, waiting to be applied by hand in D4H.
                        Apply each one in D4H, then Check it here to close it.
                    </p>
                    {groups.size === 0 ? (
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No open D4H tasks</EmptyTitle>
                                <EmptyDescription>
                                    Tasks appear here when AVUT queues a change it can&apos;t make
                                    through the D4H API.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : (
                        [...groups.values()].map((teamRows) => (
                            <section key={teamRows[0].task.d4hTeamId} className="space-y-2">
                                <h2 className="text-lg font-semibold">{teamRows[0].teamTitle}</h2>
                                <ItemGroup>
                                    {teamRows.map((row) => (
                                        <TaskRow key={row.task.id} row={row} />
                                    ))}
                                </ItemGroup>
                            </section>
                        ))
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

function TaskRow({ row: { task, requestedByName, d4hUrl } }: { row: OpenTaskRow }) {
    const { slug } = useOrganization();
    const { formatDate } = usePreferences();

    return (
        <Item variant="outline" size="sm" className="flex-wrap">
            <ItemContent className="min-w-48">
                <ItemTitle>
                    <Link
                        className="hover:underline"
                        href={route(
                            "/orgs/[slug]/d4h-i3/teams/[team_id]/equipment-items/[item_id]",
                            {
                                slug,
                                team_id: String(task.d4hTeamId),
                                item_id: String(task.resourceId),
                            },
                        )}
                    >
                        {task.itemLabel}
                    </Link>
                </ItemTitle>
                <D4HI3Module_D4HTaskChanges task={task} />
                <ItemDescription className="text-xs">
                    Requested by {requestedByName ?? "a deleted user"},{" "}
                    {formatDate(task.requestedAt)}
                </ItemDescription>
            </ItemContent>
            <ItemActions className="flex-wrap">
                <Button asChild size="sm" variant="outline">
                    <a href={d4hUrl} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon />
                        Open in D4H
                    </a>
                </Button>
                <D4HI3Module_D4HTaskActions task={task} />
            </ItemActions>
        </Item>
    );
}
