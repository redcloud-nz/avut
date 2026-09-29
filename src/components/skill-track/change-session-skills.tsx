/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState, type RefObject } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { MutationButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { useOrganization } from "@/hooks/use-organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Chooses the skills assessed in a skill check session: a collapsible package → group → skill
 * checklist. Ticks are staged locally and saved together; Cancel discards them.
 */
export function SkillTrack_ChangeSessionSkills_Dialog({
    sessionId,
    returnFocusRef,
    ...props
}: DialogProps & {
    sessionId: SkillCheckSessionId;
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    return (
        <Dialog {...props}>
            <DialogContent
                className="sm:max-w-md"
                onCloseAutoFocus={
                    returnFocusRef
                        ? (event) => {
                              event.preventDefault();
                              returnFocusRef.current?.focus();
                          }
                        : undefined
                }
            >
                <DialogHeader>
                    <DialogTitle>Change skills</DialogTitle>
                    <DialogDescription>
                        Choose the skills assessed in this session.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <ChangeSessionSkills_Body
                        sessionId={sessionId}
                        onDone={() => props.onOpenChange?.(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function ChangeSessionSkills_Body({
    sessionId,
    onDone,
}: {
    sessionId: SkillCheckSessionId;
    onDone: () => void;
}) {
    const organization = useOrganization();

    const [
        {
            data: { skills, skillGroups, skillPackages },
        },
        { data: assignedSkills },
    ] = useSuspenseQueries({
        queries: [
            trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
                organizationId: organization.id,
            }),
            trpc.skillCheckSessions.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId,
                scope: "assigned",
            }),
        ],
    });

    // Staged changes, keyed by skill id: true = add, false = remove.
    const [changes, setChanges] = useState<Record<SkillId, boolean>>({});
    const [showSkillDescriptions, setShowSkillDescriptions] = useState(false);

    const mutation = useMutation(
        trpc.skillCheckSessions.updateSessionSkills.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateSessionSkills },
            onError(error) {
                console.error("Failed to update session skills:", error);
                toast.error(`Failed to update session skills: ${error.message}`);
            },
            onSuccess() {
                toast.success("Session skills updated");
                onDone();
            },
        }),
    );

    const assignedSkillIds = new Set(assignedSkills.map((s) => s.id));

    function isSelected(skillId: SkillId) {
        return changes[skillId] ?? assignedSkillIds.has(skillId);
    }

    function handleChangeChecked(skillId: SkillId, newValue: boolean) {
        setChanges((prev) => {
            if (newValue === assignedSkillIds.has(skillId)) {
                const { [skillId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [skillId]: newValue };
        });
    }

    function handleSave() {
        const entries = Object.entries(changes) as [SkillId, boolean][];
        mutation.mutate({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
            addedSkillIds: entries.filter(([, selected]) => selected).map(([id]) => id),
            removedSkillIds: entries.filter(([, selected]) => !selected).map(([id]) => id),
        });
    }

    // Package -> group -> skills. Packages are ordered by name, groups by their authored
    // sequence, skills by name. Groups and packages left with no skills are dropped.
    const packageSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.map((skillPackage) => ({
            skillPackage,
            groups: R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.map((skillGroup) => ({
                    skillGroup,
                    skills: R.pipe(
                        skills.filter((skill) => skill.skillGroupId === skillGroup.id),
                        R.sortBy((skill) => skill.name),
                    ),
                })),
                R.filter(({ skills }) => skills.length > 0),
            ),
        })),
        R.filter(({ groups }) => groups.length > 0),
    );

    return (
        <>
            <DialogBody>
                <Field orientation="horizontal">
                    <Checkbox
                        id="show-skill-descriptions"
                        checked={showSkillDescriptions}
                        onCheckedChange={(checked) => setShowSkillDescriptions(checked === true)}
                    />
                    <FieldLabel htmlFor="show-skill-descriptions">
                        Show skill descriptions
                    </FieldLabel>
                </Field>
                {packageSections.length === 0 && (
                    <p className="text-muted-foreground">
                        No assessable skills. Subscribe to a skill package first.
                    </p>
                )}
                {packageSections.map(({ skillPackage, groups }) => {
                    const skillsInPackage = groups.flatMap(({ skills }) => skills);
                    const packageSelectedCount = skillsInPackage.filter((s) =>
                        isSelected(s.id),
                    ).length;

                    return (
                        <Collapsible key={skillPackage.id} defaultOpen>
                            <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                                <span>{skillPackage.name}</span>
                                <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                                    <span>
                                        {packageSelectedCount} of {skillsInPackage.length} selected
                                    </span>
                                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="space-y-6 pt-4">
                                    {groups.map(({ skillGroup, skills }) => (
                                        <div key={skillGroup.id}>
                                            <div className="text-sm font-medium text-muted-foreground mb-2">
                                                {skillGroup.name}
                                            </div>
                                            <FieldGroup>
                                                {skills.map((skill) => (
                                                    <Field orientation="horizontal" key={skill.id}>
                                                        <Checkbox
                                                            id={`skill-${skill.id}`}
                                                            checked={isSelected(skill.id)}
                                                            onCheckedChange={(checked) =>
                                                                handleChangeChecked(
                                                                    skill.id,
                                                                    checked === true,
                                                                )
                                                            }
                                                        />
                                                        <FieldContent>
                                                            <FieldLabel
                                                                htmlFor={`skill-${skill.id}`}
                                                            >
                                                                {skill.name}
                                                            </FieldLabel>
                                                            {showSkillDescriptions &&
                                                                skill.description && (
                                                                    <FieldDescription>
                                                                        {skill.description}
                                                                    </FieldDescription>
                                                                )}
                                                        </FieldContent>
                                                    </Field>
                                                ))}
                                            </FieldGroup>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="button"
                    disabled={Object.keys(changes).length === 0}
                    onClick={handleSave}
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                />
            </DialogFooter>
        </>
    );
}
