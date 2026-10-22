/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hTasksEffects } from "@/client/d4h-tasks-effects";
import { Button } from "@/components/ui/button";
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
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { trpc } from "@/trpc/client";

/**
 * The open D4H tasks on one equipment item, each with Check (has it been applied in D4H yet?) and
 * Dismiss. Empty when the viewer lacks D4H's Equipment RETIRE permission on the item's team.
 */
export function I3Module_ItemTasks_Card({ teamId, itemId }: { teamId: number; itemId: number }) {
    const organization = useOrganization();

    const { data: tasks } = useSuspenseQuery(
        trpc.d4hTasks.listItemTasks.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Tasks</CardTitle>
            </CardHeader>
            <CardContent>
                {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open D4H tasks</p>
                ) : (
                    <ItemGroup>
                        {tasks.map((task) => (
                            <ItemTaskRow key={task.id} task={task} />
                        ))}
                    </ItemGroup>
                )}
            </CardContent>
        </Card>
    );
}

function ItemTaskRow({ task }: { task: D4HTask }) {
    const organization = useOrganization();
    const { formatDate } = usePreferences();

    const checkMutation = useMutation(
        trpc.d4hTasks.checkTask.mutationOptions({
            meta: { effects: d4hTasksEffects.checkTask },
            onError: (error) => toast.error(`Check failed: ${error.message}`),
            onSuccess: (result) => {
                switch (result.result) {
                    case "applied":
                        toast.success(`${task.itemLabel} is retired in D4H. Task done.`);
                        break;
                    case "pending":
                        toast.info(
                            `${task.itemLabel} is not retired yet (D4H status: ${D4HEquipmentStatus.label(result.status)}).`,
                        );
                        break;
                    case "missing":
                        toast.warning(
                            `${task.itemLabel} no longer exists in D4H. Dismiss the task instead.`,
                        );
                        break;
                }
            },
        }),
    );

    const dismissMutation = useMutation(
        trpc.d4hTasks.dismissTask.mutationOptions({
            meta: { effects: d4hTasksEffects.dismissTask },
            onError: (error) => toast.error(`Dismiss failed: ${error.message}`),
            onSuccess: () => toast.success(`Task on ${task.itemLabel} dismissed.`),
        }),
    );

    const isPending = checkMutation.isPending || dismissMutation.isPending;

    return (
        <Item variant="outline" size="sm">
            <ItemContent>
                <ItemTitle>
                    {task.kind} — {task.payload.reason}
                </ItemTitle>
                <ItemDescription>Requested {formatDate(task.requestedAt)}</ItemDescription>
            </ItemContent>
            <ItemActions>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                        checkMutation.mutate({ organizationId: organization.id, taskId: task.id })
                    }
                >
                    Check
                </Button>
                <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() =>
                        dismissMutation.mutate({ organizationId: organization.id, taskId: task.id })
                    }
                >
                    Dismiss
                </Button>
            </ItemActions>
        </Item>
    );
}
