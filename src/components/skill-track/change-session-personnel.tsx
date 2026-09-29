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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Chooses the personnel assessed in a skill check session: a collapsible checklist per team.
 * Ticks are staged locally and saved together; Cancel discards them.
 */
export function SkillTrack_ChangeSessionPersonnel_Dialog({
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
                    <DialogTitle>Change personnel</DialogTitle>
                    <DialogDescription>Choose who is assessed in this session.</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <ChangeSessionPersonnel_Body
                        sessionId={sessionId}
                        onDone={() => props.onOpenChange?.(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function ChangeSessionPersonnel_Body({
    sessionId,
    onDone,
}: {
    sessionId: SkillCheckSessionId;
    onDone: () => void;
}) {
    const organization = useOrganization();

    const [{ data: assignedPersonnel }, { data: teams }, { data: teamMemberships }] =
        useSuspenseQueries({
            queries: [
                trpc.skillCheckSessions.listSessionAssessees.queryOptions({
                    organizationId: organization.id,
                    sessionId,
                    scope: "assigned",
                }),
                trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
                trpc.teams.listTeamMemberships.queryOptions({ organizationId: organization.id }),
            ],
        });

    // Staged changes, keyed by person id: true = add, false = remove. Keyed by person rather than
    // membership, so a person on several teams toggles in every section.
    const [changes, setChanges] = useState<Record<PersonId, boolean>>({});

    const mutation = useMutation(
        trpc.skillCheckSessions.updateSessionAssessees.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateSessionAssessees },
            onError(error) {
                console.error("Failed to update session personnel:", error);
                toast.error(`Failed to update session personnel: ${error.message}`);
            },
            onSuccess() {
                toast.success("Session personnel updated");
                onDone();
            },
        }),
    );

    const assignedPersonIds = new Set(assignedPersonnel.map((p) => p.id));

    function isSelected(personId: PersonId) {
        return changes[personId] ?? assignedPersonIds.has(personId);
    }

    function handleChangeChecked(personId: PersonId, newValue: boolean) {
        setChanges((prev) => {
            if (newValue === assignedPersonIds.has(personId)) {
                const { [personId]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [personId]: newValue };
        });
    }

    function handleSave() {
        const entries = Object.entries(changes) as [PersonId, boolean][];
        mutation.mutate({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
            addedPersonIds: entries.filter(([, selected]) => selected).map(([id]) => id),
            removedPersonIds: entries.filter(([, selected]) => !selected).map(([id]) => id),
        });
    }

    // Team -> members. Teams are ordered by name, members by name. Teams left with no members
    // are dropped.
    const teamSections = R.pipe(
        teams,
        R.filter((team) => team.status === "Active"),
        R.sortBy((team) => team.name),
        R.map((team) => ({
            team,
            members: R.pipe(
                teamMemberships.filter((m) => m.teamId === team.id),
                R.sortBy((m) => m.person.name),
            ),
        })),
        R.filter(({ members }) => members.length > 0),
    );

    return (
        <>
            <DialogBody>
                {teamSections.length === 0 && (
                    <p className="text-muted-foreground">No active teams have any members.</p>
                )}
                {teamSections.map(({ team, members }) => {
                    const teamSelectedCount = members.filter((m) => isSelected(m.person.id)).length;

                    return (
                        <Collapsible key={team.id} defaultOpen>
                            <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                                <span>{team.name}</span>
                                <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                                    <span>
                                        {teamSelectedCount} of {members.length} selected
                                    </span>
                                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <FieldGroup className="pt-4">
                                    {members.map((membership) => (
                                        <Field orientation="horizontal" key={membership.id}>
                                            <Checkbox
                                                id={`membership-${membership.id}`}
                                                checked={isSelected(membership.person.id)}
                                                onCheckedChange={(checked) =>
                                                    handleChangeChecked(
                                                        membership.person.id,
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            <FieldLabel htmlFor={`membership-${membership.id}`}>
                                                {membership.person.name}
                                            </FieldLabel>
                                        </Field>
                                    ))}
                                </FieldGroup>
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
