/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers";
import { RestrictToElement } from "@dnd-kit/dom/modifiers";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

/**
 * Dialog component that allows users to reorder skills within a skill group using drag-and-drop functionality.
 * It fetches the skills for the specified skill group, displays them in a sortable list, and updates their order in the database when the user saves their changes.
 */
export function SkillPackageBuilder_ReorderSkills_Dialog({
    skillGroup,
    skillPackage,
    ...props
}: DialogProps & { skillGroup: SkillGroup; skillPackage: SkillPackage }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const skillsQuery = useQuery(
        trpc.skillPackageBuilder.listSkills.queryOptions({
            organizationId: organization.id,
            skillPackageId: skillGroup.skillPackageId,
        }),
    );
    const skills = (skillsQuery.data ?? [])
        .filter((s) => s.skillGroupId === skillGroup.id)
        .sort((a, b) => a.sequence - b.sequence);

    const [order, setOrder] = useState<SkillId[]>([]);

    useEffect(() => {
        // Set the initial order of skills based on their current sequence in the database once the data is ready.
        if (skillsQuery.isSuccess) setOrder(skills.map((skill) => skill.id));
    }, [skillsQuery.isSuccess]);

    const mutation = useMutation(
        trpc.skillPackageBuilder.reorderGroupSkills.mutationOptions({
            onError(error) {
                toast.error(`Failed to save changes: ${error.message}`);
                console.error("Failed to save changes:", error);
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listSkills.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                );

                // Close the dialog and reset the mutation state after successfully saving the new order.
                props.onOpenChange?.(false);
                mutation.reset();
            },
        }),
    );

    useEffect(() => {
        if (!props.open) {
            mutation.reset();
            setOrder(skills.map((skill) => skill.id));
        }
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reorder Skills</DialogTitle>
                    <DialogDescription>
                        Drag and drop the skills to reorder them within the group{" "}
                        <ObjectName>{skillPackage.name}</ObjectName>
                        {" / "}
                        <ObjectName>{skillGroup.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>

                <Show
                    when={skills.length > 0}
                    fallback={
                        <Empty>
                            <EmptyHeader>
                                <EmptyTitle>No skills to reorder</EmptyTitle>
                                <EmptyDescription>
                                    This group does not contain any skills to reorder. Please add
                                    skills to this group before attempting to reorder.
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
                                        console.log("New Order: ", newOrder);
                                        return newOrder;
                                    });
                                }
                            }
                        }}
                    >
                        <div className="space-y-2" id="sortable-skill-list">
                            {order.map((skillId, index) => {
                                const skill = skills.find((s) => s.id === skillId)!;

                                return (
                                    <SortableSkill
                                        key={skillId}
                                        skill={skill}
                                        index={index}
                                        isLast={index === skills.length - 1}
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
                    <DialogFooter>
                        <MutationButton
                            type="button"
                            onClick={() =>
                                mutation.mutate({
                                    organizationId: organization.id,
                                    skillGroupId: skillGroup.id,
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
                        <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    </DialogFooter>
                </Show>
            </DialogContent>
        </Dialog>
    );
}

function SortableSkill({
    index,
    skill,
    isLast,
    onSwap,
}: {
    index: number;
    skill: Skill;
    isLast: boolean;
    onSwap: (fromIndex: number, toIndex: number) => void;
}) {
    const { ref, handleRef, isDragging } = useSortable({
        id: skill.id,
        index,
        modifiers: [
            RestrictToVerticalAxis,
            RestrictToElement.configure({
                element: document.getElementById("sortable-skill-list"),
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

            <div className="grow">{skill.name}</div>

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
