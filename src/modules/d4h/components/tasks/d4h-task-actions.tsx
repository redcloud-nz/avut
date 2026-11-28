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
 * reporting its result with a toast. Both are disabled without `d4hTask: ["apply"]`, which
 * `checkTask` and `dismissTask` require.
 */
export function D4HModule_D4HTaskActions({ task }: { task: D4HTask }) {
    const organization = useOrganization();

    const checkMutation = useMutation(
        trpc.d4hTasks.checkTask.mutationOptions({
            meta: { effects: d4hTasksEffects.checkTask },
            onError: (error) => toast.error(`Check failed: ${error.message}`),
            onSuccess: (result) => {
                switch (result.result) {
                    case "applied":
                        toast.success(`${appliedMessage(task)} Task done.`);
                        break;
                    case "pending":
                        toast.info(pendingMessage(task, result));
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
                permissions={{ d4hTask: ["apply"] }}
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
                permissions={{ d4hTask: ["apply"] }}
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

/** What Check found once the task's change is in D4H, per kind. */
function appliedMessage(task: D4HTask): string {
    switch (task.kind) {
        case "Retire":
            return `${task.itemLabel} is retired in D4H.`;
        case "SetSerial":
            return `${task.itemLabel} has serial ${task.payload.serial} in D4H.`;
        case "SetVariant":
            return `${task.itemLabel} is ${task.payload.brand} ${task.payload.model} in D4H.`;
        case "MarkLost":
            return `${task.itemLabel} is marked Lost in D4H.`;
    }
}

/** What's still to do in D4H, per kind, with what D4H has now. */
function pendingMessage(
    task: D4HTask,
    current: { status: string; serial: string | null; brand: string | null; model: string | null },
): string {
    switch (task.kind) {
        case "Retire":
            return `${task.itemLabel} is not retired yet (D4H status: ${D4HEquipmentStatus.label(current.status)}).`;
        case "SetSerial":
            return `${task.itemLabel}'s serial is not set to ${task.payload.serial} yet (D4H serial: ${current.serial?.trim() || "none"}).`;
        case "SetVariant": {
            const d4hVariant = [current.brand, current.model].filter(Boolean).join(" ") || "none";
            return `${task.itemLabel} is not set to ${task.payload.brand} ${task.payload.model} yet (D4H brand/model: ${d4hVariant}).`;
        }
        case "MarkLost":
            return `${task.itemLabel} is not marked Lost yet (D4H status: ${D4HEquipmentStatus.label(current.status)}).`;
    }
}
