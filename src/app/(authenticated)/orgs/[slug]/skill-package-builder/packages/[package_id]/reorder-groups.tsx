/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import { ComponentProps, useEffect, useState } from "react";
import { toast } from "sonner";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { eq, useLiveQuery } from "@tanstack/react-db";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup } from "@/components/ui/field";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import {
    getSkillGroupsCollection,
    reorderGroupsAction,
} from "@/lib/collections/skill-groups";
import { SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { cn } from "@/lib/utils";

interface ReorderGroupsDialogProps extends ComponentProps<typeof Dialog> {
    skillPackage: SkillPackage;
}

/**
 * Dialog component that allows users to reorder skill groups within a skill package using drag-and-drop functionality.
 * It fetches the skill groups for the specified skill package, displays them in a sortable list, and updates their order in the database when the user saves their changes.
 */
export function ReorderGroupsDialog({
    skillPackage,
    ...props
}: ReorderGroupsDialogProps) {
    const organization = useOrganization();

    const { data: skillGroups, isReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    skillGroup: getSkillGroupsCollection(organization.id),
                })
                .where(({ skillGroup }) =>
                    eq(skillGroup.skillPackageId, skillPackage.id),
                )
                .orderBy(({ skillGroup }) => skillGroup.sequence),
        [props.open],
    );

    const [order, setOrder] = useState<SkillGroupId[]>([]);

    useEffect(() => {
        // Set the initial order of skill groups based on their current sequence in the database once the data is ready.
        if (isReady) setOrder(skillGroups.map((group) => group.id));
    }, [isReady]);

    function handleReset() {
        setOrder(skillGroups.map((group) => group.id));
    }

    function handleSave() {
        props.onOpenChange?.(false);

        toast.promise(
            async () => {
                const tx = reorderGroupsAction({
                    organizationId: organization.id,
                    skillPackageId: skillPackage.id,
                    newOrder: order,
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Applying new group order...",
                success: "Groups reordered successfully",
                error: (error) => `Failed to reorder groups: ${error.message}`,
            },
        );
    }

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reorder Groups</DialogTitle>
                    <DialogDescription>
                        Drag and drop the groups to reorder them within the
                        skill package{" "}
                        <ObjectName>{skillPackage.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>

                <DragDropProvider
                    onDragEnd={(event) => {
                        if (event.canceled) return;

                        const { source } = event.operation;

                        if (isSortable(source)) {
                            const { initialIndex, index } = source;

                            if (initialIndex != index) {
                                setOrder((prevOrder) => {
                                    const newOrder = [...prevOrder];
                                    const [removed] = newOrder.splice(
                                        initialIndex,
                                        1,
                                    );
                                    newOrder.splice(index, 0, removed);
                                    console.log("New Order: ", newOrder);
                                    return newOrder;
                                });
                            }
                        }
                    }}
                >
                    <div className="space-y-2" id="sortable-group-list">
                        {order.map((groupId, index) => {
                            const group = skillGroups.find(
                                (g) => g.id === groupId,
                            )!;

                            return (
                                <SortableGroup
                                    key={groupId}
                                    group={group}
                                    index={index}
                                    isLast={index === skillGroups.length - 1}
                                    onSwap={(fromIndex, toIndex) => {
                                        setOrder((prevOrder) => {
                                            const newOrder = [...prevOrder];
                                            const [moved] = newOrder.splice(
                                                fromIndex,
                                                1,
                                            );
                                            newOrder.splice(toIndex, 0, moved);
                                            return newOrder;
                                        });
                                    }}
                                />
                            );
                        })}
                    </div>
                </DragDropProvider>

                <FieldGroup>
                    <Field orientation="horizontal">
                        <Button type="button" onClick={handleSave}>
                            Save
                        </Button>
                        <Button variant="outline" onClick={handleReset}>
                            Reset
                        </Button>
                    </Field>
                </FieldGroup>
            </DialogContent>
        </Dialog>
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
            <Button
                variant="ghost"
                size="icon"
                className="cursor-move"
                ref={handleRef}
            >
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
