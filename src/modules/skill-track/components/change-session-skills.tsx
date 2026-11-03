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
import { useReturnFocus } from "@/hooks/use-return-focus";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { useRefetchSessionOnConflict } from "@/modules/skill-track/components/use-refetch-session-on-conflict";
import { groupSkillSections } from "@/modules/skill-track/lib/skill-sections";
import { trpc } from "@/trpc/client";

/**
 * Chooses the skills assessed in a skill check session: a checklist with one collapsible
 * "Package · Group" section per skill group. Ticks are staged locally and saved together; Cancel discards them.
 */
export function SkillTrack_ChangeSessionSkills_Dialog({
    sessionId,
    returnFocusRef,
    ...props
}: DialogProps & {
    sessionId: SkillCheckSessionId;
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const returnFocus = useReturnFocus(returnFocusRef);

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
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

    const refetchSessionOnConflict = useRefetchSessionOnConflict(sessionId);
    const mutation = useMutation(
        trpc.skillCheckSessions.updateSessionSkills.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateSessionSkills },
            onError(error) {
                console.error("Failed to update session skills:", error);
                toast.error(`Failed to update session skills: ${error.message}`);
                refetchSessionOnConflict(error);
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

    // One "Package · Group" section per skill group, skills by name.
    const skillsByName: typeof skills = R.sortBy(skills, (skill) => skill.name);
    const groupSections = groupSkillSections({
        skillPackages,
        skillGroups,
        items: skillsByName,
        skillGroupIdOf: (skill) => skill.skillGroupId,
    });

    // Assigned skills outside the assessable set: their package has been withdrawn (or they are
    // otherwise no longer assessable). Listed from the saved assignment, so a skill unticked here
    // stays listed until Save and the change can be undone.
    const assessableSkillIds = new Set(skills.map((skill) => skill.id));
    const unavailableSkills = R.pipe(
        assignedSkills,
        R.filter((skill) => !assessableSkillIds.has(skill.id)),
        R.sortBy((skill) => skill.name),
    );
    const unavailableSelectedCount = unavailableSkills.filter((s) => isSelected(s.id)).length;

    function renderSkillField(skill: { id: SkillId; name: string; description?: string }) {
        return (
            <Field orientation="horizontal" key={skill.id}>
                <Checkbox
                    id={`skill-${skill.id}`}
                    checked={isSelected(skill.id)}
                    onCheckedChange={(checked) => handleChangeChecked(skill.id, checked === true)}
                />
                <FieldContent>
                    <FieldLabel htmlFor={`skill-${skill.id}`}>{skill.name}</FieldLabel>
                    {showSkillDescriptions && skill.description && (
                        <FieldDescription>{skill.description}</FieldDescription>
                    )}
                </FieldContent>
            </Field>
        );
    }

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
                {groupSections.length === 0 && unavailableSkills.length === 0 && (
                    <p className="text-muted-foreground">
                        No assessable skills. Subscribe to a skill package first.
                    </p>
                )}
                {groupSections.map((section) => {
                    const selectedCount = section.items.filter((s) => isSelected(s.id)).length;

                    return (
                        <Collapsible key={section.id} defaultOpen>
                            <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                                <span>{section.label}</span>
                                <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                                    <span>
                                        {selectedCount} of {section.items.length} selected
                                    </span>
                                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <FieldGroup className="pt-4">
                                    {section.items.map(renderSkillField)}
                                </FieldGroup>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
                {unavailableSkills.length > 0 && (
                    <Collapsible defaultOpen>
                        <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                            <span>No longer available</span>
                            <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                                <span>
                                    {unavailableSelectedCount} of {unavailableSkills.length}{" "}
                                    selected
                                </span>
                                <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                            </span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <FieldGroup className="pt-4">
                                {unavailableSkills.map(renderSkillField)}
                            </FieldGroup>
                        </CollapsibleContent>
                    </Collapsible>
                )}
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
