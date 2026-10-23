/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { d4hTasksEffects } from "@/client/d4h-tasks-effects";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { D4HTask } from "@/lib/schemas/d4h-task";
import { D4HEquipmentStatus } from "@/lib/schemas/d4h/equipment-item";
import { trpc } from "@/trpc/client";

/**
 * Check (has the task been applied in D4H yet?) and Dismiss buttons for one open D4H task, each
 * reporting its result with a toast. Both are disabled without `i3Item: ["update"]`, which
 * `checkTask` and `dismissTask` require.
 */
export function D4HI3Module_D4HTaskActions({ task }: { task: D4HTask }) {
    const organization = useOrganization();

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
        <>
            <Protect
                permissions={{ i3Item: ["update"] }}
                render={(hasPermission) => (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!hasPermission || isPending}
                        onClick={() =>
                            checkMutation.mutate({
                                organizationId: organization.id,
                                taskId: task.id,
                            })
                        }
                    >
                        Check
                    </Button>
                )}
            />
            <Protect
                permissions={{ i3Item: ["update"] }}
                render={(hasPermission) => (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={!hasPermission || isPending}
                        onClick={() =>
                            dismissMutation.mutate({
                                organizationId: organization.id,
                                taskId: task.id,
                            })
                        }
                    >
                        Dismiss
                    </Button>
                )}
            />
        </>
    );
}
