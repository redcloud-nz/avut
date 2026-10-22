/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { D4HTask } from "@/lib/schemas/d4h-task";
import { trpc } from "@/trpc/client";

import { I3Module_D4HTaskActions } from "../d4h-task-actions";

/**
 * The open D4H tasks on one equipment item, each with Check (has it been applied in D4H yet?) and
 * Dismiss. `listItemTasks` returns nothing to a viewer without D4H's Equipment RETIRE permission
 * on the item's team, so for them the card says why instead of claiming there are no tasks.
 */
export function I3Module_ItemTasks_Card({
    teamId,
    itemId,
    canRetireInD4H,
}: {
    teamId: number;
    itemId: number;
    canRetireInD4H: boolean;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Tasks</CardTitle>
            </CardHeader>
            <CardContent>
                {canRetireInD4H ? (
                    <ItemTaskList teamId={teamId} itemId={itemId} />
                ) : (
                    <p className="text-sm text-muted-foreground">
                        You need D4H&apos;s Equipment Retire permission to see this item&apos;s
                        tasks.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function ItemTaskList({ teamId, itemId }: { teamId: number; itemId: number }) {
    const organization = useOrganization();

    const { data: tasks } = useSuspenseQuery(
        trpc.d4hTasks.listItemTasks.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );

    if (tasks.length === 0) {
        return <p className="text-sm text-muted-foreground">No open D4H tasks</p>;
    }

    return (
        <ItemGroup>
            {tasks.map((task) => (
                <ItemTaskRow key={task.id} task={task} />
            ))}
        </ItemGroup>
    );
}

function ItemTaskRow({ task }: { task: D4HTask }) {
    const { formatDate } = usePreferences();

    return (
        <Item variant="outline" size="sm">
            <ItemContent>
                <ItemTitle>
                    {task.kind} — {task.payload.reason}
                </ItemTitle>
                <ItemDescription>Requested {formatDate(task.requestedAt)}</ItemDescription>
            </ItemContent>
            <ItemActions>
                <I3Module_D4HTaskActions task={task} />
            </ItemActions>
        </Item>
    );
}
