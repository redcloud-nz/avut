/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";

import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

/**
 * Dialog component that allows users to reorder skill groups within a skill package using drag-and-drop functionality.
 * It fetches the skill groups for the specified skill package, displays them in a sortable list, and updates their order in the database when the user saves their changes.
 */
export function SkillPackageBuilder_ReorderGroups_Dialog({
    skillPackage,
    ...props
}: DialogProps & { skillPackage: SkillPackage }) {
    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reorder Groups</DialogTitle>
                    <DialogDescription>
                        Drag and drop the groups to reorder them within the skill package{" "}
                        <ObjectName>{skillPackage.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>

                {/* Radix only mounts DialogContent's children while the dialog is
                    open, so the body (and its `order` state) is created fresh on
                    each open — always seeded from the current groups, with no
                    reseeding effect needed. */}
                <Suspense fallback={<ReorderGroups_Skeleton />}>
                    <ReorderGroups_Body
                        skillPackage={skillPackage}
                        onSaved={() => props.onOpenChange?.(false)}
                    />
                </Suspense>
            </DialogContent>
        </Dialog>
    );
}

function ReorderGroups_Skeleton() {
    return (
        <div className="space-y-2">
            <Skeleton className="w-full h-11" />
            <Skeleton className="w-full h-11" />
            <Skeleton className="w-full h-11" />
        </div>
    );
}

function ReorderGroups_Body({
    skillPackage,
    onSaved,
}: {
    skillPackage: SkillPackage;
    onSaved: () => void;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const groupsQuery = useSuspenseQuery(
        trpc.skillPackageBuilder.listGroups.queryOptions({
            organizationId: organization.id,
            skillPackageId: skillPackage.id,
        }),
    );
    const skillGroups = [...groupsQuery.data].sort((a, b) => a.sequence - b.sequence);

    // Suspense guarantees the data, so seed the drag order directly. This body
    // remounts on each open, so the seed always reflects the current groups.
    const [order, setOrder] = useState<SkillGroupId[]>(() => skillGroups.map((group) => group.id));

    const mutation = useMutation(
        trpc.skillPackageBuilder.reorderGroups.mutationOptions({
            onError(error) {
                toast.error(`Failed to save changes: ${error.message}`);
                console.error("Failed to save changes:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listGroups.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                );

                onSaved();
            },
        }),
    );

    return (
        <>
            <Show
                when={skillGroups.length > 0}
                fallback={
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>No groups to reorder</EmptyTitle>
                            <EmptyDescription>
                                This skill package does not contain any groups to reorder. Please
                                add groups to this package before attempting to reorder.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                }
            >
                <DragDropProvider
                    onDragEnd={(event) => {
                        if (event.canceled) return;

                        const { source } = event.operation;

                        if (isSortable(source)) {
                            const { initialIndex, index } = source;

                            if (initialIndex != index) {
                                setOrder((prevOrder) => {
                                    const newOrder = [...prevOrder];
                                    const [removed] = newOrder.splice(initialIndex, 1);
                                    newOrder.splice(index, 0, removed);
                                    return newOrder;
                                });
                            }
                        }
                    }}
                >
                    <div className="space-y-2" id="sortable-group-list">
                        {order.map((groupId, index) => {
                            const group = skillGroups.find((g) => g.id === groupId)!;

                            return (
                                <SortableGroup
                                    key={groupId}
                                    group={group}
                                    index={index}
                                    isLast={index === order.length - 1}
                                    onSwap={(fromIndex, toIndex) => {
                                        setOrder((prevOrder) => {
                                            const newOrder = [...prevOrder];
                                            const [moved] = newOrder.splice(fromIndex, 1);
                                            newOrder.splice(toIndex, 0, moved);
                                            return newOrder;
                                        });
                                    }}
                                />
                            );
                        })}
                    </div>
                </DragDropProvider>
            </Show>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="button"
                    onClick={() =>
                        mutation.mutate({
                            organizationId: organization.id,
                            skillPackageId: skillPackage.id,
                            newOrder: order,
                        })
                    }
                    status={mutation.status}
                    text={{
                        idle: "Save",
                        pending: "Saving",
                        success: "Saved",
                    }}
                />
            </DialogFooter>
        </>
    );
}

function SortableGroup({
    index,
    group,
    isLast,
    onSwap,
}: {
    index: number;
    group: SkillGroup;
    isLast: boolean;
    onSwap: (fromIndex: number, toIndex: number) => void;
}) {
    const { ref, handleRef, isDragging } = useSortable({
        id: group.id,
        index,
        modifiers: [
            RestrictToVerticalAxis,
            RestrictToElement.configure({
                element: document.getElementById("sortable-group-list"),
            }),
        ],
    });

    return (
        <div
            ref={ref}
            className={cn(
                "border border-item rounded-md p-1",
                "flex items-center gap-1",
                isDragging && "transform-scale-105 backdrop-blur-sm shadow-md",
            )}
            data-dragging={isDragging}
        >
            <Button variant="ghost" size="icon" className="cursor-move" ref={handleRef}>
                <GripVerticalIcon />
            </Button>

            <div className="grow">{group.name}</div>

            <ButtonGroup className={cn(isDragging && "invisible")}>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={index === 0}
                    onClick={() => onSwap(index, index - 1)}
                >
                    <ArrowUpIcon />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isLast}
                    onClick={() => onSwap(index, index + 1)}
                >
                    <ArrowDownIcon />
                </Button>
            </ButtonGroup>
        </div>
    );
}
