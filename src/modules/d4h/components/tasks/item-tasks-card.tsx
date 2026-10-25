/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup } from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { D4HTask } from "@/lib/schemas/d4h-task";
import { trpc } from "@/trpc/client";

import { D4HModule_D4HTaskActions } from "./d4h-task-actions";
import { D4HModule_D4HTaskChanges } from "./d4h-task-changes";

/**
 * A summary of the open D4H tasks on one equipment item ("2 pending D4H tasks"). Clicking a
 * non-zero summary opens a dialog (`?action=tasks`) listing each task with Check (has it been
 * applied in D4H yet?) and Dismiss.
 *
 * `listItemTasks` returns nothing to a viewer without D4H's Equipment RETIRE permission on the
 * item's team, so for them the card says why instead of claiming there are no tasks.
 */
export function D4HModule_ItemTasks_Card({
    teamId,
    itemId,
    itemLabel,
    canRetireInD4H,
}: {
    teamId: number;
    itemId: number;
    /** e.g. `#1234 Helmet`, for the dialog title. */
    itemLabel: string;
    canRetireInD4H: boolean;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Tasks</CardTitle>
            </CardHeader>
            <CardContent>
                {canRetireInD4H ? (
                    <ItemTasksSummary teamId={teamId} itemId={itemId} itemLabel={itemLabel} />
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

function pendingTasksLabel(count: number) {
    if (count === 0) return "No pending D4H tasks";
    if (count === 1) return "1 pending D4H task";
    return `${count} pending D4H tasks`;
}

function ItemTasksSummary({
    teamId,
    itemId,
    itemLabel,
}: {
    teamId: number;
    itemId: number;
    itemLabel: string;
}) {
    const organization = useOrganization();

    const { data: tasks } = useSuspenseQuery(
        trpc.d4hTasks.listItemTasks.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["tasks"] as const));

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "tasks" : null, { history: open ? "push" : "replace" });
    }

    if (tasks.length === 0 && action !== "tasks") {
        return <p className="text-sm text-muted-foreground">{pendingTasksLabel(0)}</p>;
    }

    return (
        <Dialog open={action === "tasks"} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="link" className="h-auto p-0">
                    {pendingTasksLabel(tasks.length)}
                </Button>
            </DialogTrigger>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>D4H Tasks on {itemLabel}</DialogTitle>
                    <DialogDescription>
                        Changes to make by hand in D4H. Check marks a task done once the change is
                        in D4H.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    {tasks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{pendingTasksLabel(0)}</p>
                    ) : (
                        <ItemGroup>
                            {tasks.map((task) => (
                                <ItemTaskRow key={task.id} task={task} />
                            ))}
                        </ItemGroup>
                    )}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}

function ItemTaskRow({ task }: { task: D4HTask }) {
    const { formatDate } = usePreferences();

    return (
        <Item variant="outline" size="sm">
            <ItemContent>
                <D4HModule_D4HTaskChanges task={task} />
                <ItemDescription className="text-xs">
                    Requested {formatDate(task.requestedAt)}
                </ItemDescription>
            </ItemContent>
            <ItemActions>
                <D4HModule_D4HTaskActions task={task} />
            </ItemActions>
        </Item>
    );
}
