/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";

import { useOrganization } from "@/hooks/use-organization";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

export function SkillsModule_SessionRecord_Skills_Tab({ session }: { session: SkillCheckSession }) {
    const organization = useOrganization();

    const [
        {
            data: { skills, skillGroups, skillPackages },
        },
        { data: assignedSkills },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.listAssessableSkills.queryOptions({
                organizationId: organization.id,
            }),
            trpc.skills.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: session.id,
            }),
        ],
    });

    const mutation = useMutation(
        trpc.skills.updateSessionSkills.mutationOptions({
            onError(error) {
                console.error("Failed to update session skills:", error);
                toast.error(`Failed to update session skills. ${error.message}`);
            },
            onSuccess({ updated }, _variables, _onMutateResult, context) {
                toast.success("Session skills updated.");

                setChanges({});

                context.client.setQueryData(
                    trpc.skills.listSessionSkills.queryKey({
                        organizationId: organization.id,
                        sessionId: session.id,
                    }),
                    updated,
                );
            },
        }),
    );

    const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

    const [changes, setChanges] = useState<Record<SkillId, boolean>>({});

    const assignedSkillIds = assignedSkills.map((s) => s.id);

    function handleChangeChecked(skillId: SkillId, newValue: boolean) {
        if (mutation.status == "success") {
            mutation.reset();
        }

        const previousValue = assignedSkillIds.includes(skillId);

        let updatedChanges: typeof changes;
        if (newValue === previousValue) {
            // If the new value matches the previous value, remove it from changes (no change needed)
            const { [skillId]: _, ...rest } = changes;
            updatedChanges = rest;
        } else {
            // Otherwise, record the change
            updatedChanges = { ...changes, [skillId]: newValue };
        }

        setChanges(updatedChanges);

        debouncer.maybeExecute({
            organizationId: organization.id,
            skillCheckSessionId: session.id,
            addedSkillIds: Object.entries(updatedChanges)
                .filter(([_, selected]) => selected)
                .map(([id, _]) => id as SkillId),
            removedSkillIds: Object.entries(updatedChanges)
                .filter(([_, selected]) => !selected)
                .map(([id, _]) => id as SkillId),
        });
    }

    function isSelected(skillId: SkillId): boolean {
        return changes[skillId] ?? assignedSkillIds.includes(skillId);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skills to assess</CardTitle>
                <CardDescription>
                    Select the skills you want to assess in this skill check session.
                </CardDescription>
                <CardAction>
                    <SaveStatusIndicator status={mutation.status} />
                </CardAction>
            </CardHeader>
            <CardContent>
                <FieldSet>
                    {skillPackages
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((skillPackage) => {
                            const skillsInPackage = skills.filter(
                                (s) => s.skillPackageId === skillPackage.id,
                            );
                            if (skillsInPackage.length === 0) {
                                return null;
                            }
                            const packageSelectedCount = skillsInPackage.filter((s) =>
                                isSelected(s.id),
                            ).length;

                            return (
                                <Collapsible key={skillPackage.id}>
                                    <CollapsibleTrigger className="group w-full flex items-center px-2 py-1 justify-between transition-none hover:bg-accent hover:text-accent-foreground border-b">
                                        <div className="font-medium">{skillPackage.name}</div>
                                        <div className="flex item-center gap-2">
                                            <div className="flex gap-1 text-muted-foreground">
                                                <span>
                                                    {packageSelectedCount}/{skillsInPackage.length}
                                                </span>
                                                <span className="hidden md:inline">selected</span>
                                            </div>
                                            <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <FieldGroup className="py-4 pl-2">
                                            {skillGroups
                                                .filter((g) => g.skillPackageId === skillPackage.id)
                                                .sort((a, b) => a.sequence - b.sequence)
                                                .map((skillGroup) => {
                                                    const skillsInGroup = skillsInPackage.filter(
                                                        (s) => s.skillGroupId === skillGroup.id,
                                                    );
                                                    if (skillsInGroup.length === 0) {
                                                        return null;
                                                    }
                                                    const groupSelectedCount = skillsInGroup.filter(
                                                        (s) => isSelected(s.id),
                                                    ).length;

                                                    return (
                                                        <Collapsible key={skillGroup.id}>
                                                            <CollapsibleTrigger className="group w-full flex items-center px-2 py-1 justify-between transition-none hover:bg-accent hover:text-accent-foreground border-b">
                                                                <div className="font-medium">
                                                                    {skillGroup.name}
                                                                </div>
                                                                <div className="flex item-center gap-2">
                                                                    <div className="flex gap-1 text-muted-foreground">
                                                                        <span>
                                                                            {groupSelectedCount}/
                                                                            {skillsInGroup.length}
                                                                        </span>
                                                                        <span className="hidden md:inline">
                                                                            selected
                                                                        </span>
                                                                    </div>
                                                                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                                                </div>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                                <FieldGroup className="py-4 px-2">
                                                                    {skillsInGroup
                                                                        .sort((a, b) =>
                                                                            a.name.localeCompare(
                                                                                b.name,
                                                                            ),
                                                                        )
                                                                        .map((skill) => (
                                                                            <Field
                                                                                orientation="horizontal"
                                                                                key={skill.id}
                                                                            >
                                                                                <Checkbox
                                                                                    id={`skill-${skill.id}`}
                                                                                    checked={isSelected(
                                                                                        skill.id,
                                                                                    )}
                                                                                    onCheckedChange={(
                                                                                        checked,
                                                                                    ) => {
                                                                                        handleChangeChecked(
                                                                                            skill.id,
                                                                                            !!checked,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                                <FieldLabel>
                                                                                    {skill.name}
                                                                                </FieldLabel>
                                                                            </Field>
                                                                        ))}
                                                                </FieldGroup>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    );
                                                })}
                                        </FieldGroup>
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })}
                </FieldSet>
            </CardContent>
        </Card>
    );
}
