/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState, type RefObject } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { useRefetchSessionOnConflict } from "@/components/skill-track/use-refetch-session-on-conflict";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MutationButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Chooses the assessors of a skill check session: a flat checklist of the people who can record
 * checks, plus anyone already assigned who no longer can (so they can be taken off). Ticks are
 * staged locally and saved together; Cancel discards them.
 */
export function SkillTrack_ChangeSessionAssessors_Dialog({
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
                    <DialogTitle>Change assessors</DialogTitle>
                    <DialogDescription>
                        Choose who can record checks in this session.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <ChangeSessionAssessors_Body
                        sessionId={sessionId}
                        onDone={() => props.onOpenChange?.(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function ChangeSessionAssessors_Body({
    sessionId,
    onDone,
}: {
    sessionId: SkillCheckSessionId;
    onDone: () => void;
}) {
    const organization = useOrganization();

    const [{ data: eligibleAssessors }, { data: assignedAssessors }, { data: personSelf }] =
        useSuspenseQueries({
            queries: [
                trpc.skillCheckSessions.listEligibleAssessors.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.skillCheckSessions.listSessionAssessors.queryOptions({
                    organizationId: organization.id,
                    sessionId,
                    scope: "assigned",
                }),
                trpc.personnel.getPersonSelf.queryOptions({ organizationId: organization.id }),
            ],
        });

    // The same check the entry pages use for recording (see `setSessionSkillCheck` and
    // `deleteSessionSkillCheck`).
    const canRecordChecks = useHasPermission({ skillCheck: ["create"] });

    // Staged changes, keyed by person id: true = add, false = remove.
    const [changes, setChanges] = useState<Record<PersonId, boolean>>({});

    const refetchSessionOnConflict = useRefetchSessionOnConflict(sessionId);
    const mutation = useMutation(
        trpc.skillCheckSessions.updateSessionAssessors.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateSessionAssessors },
            onError(error) {
                console.error("Failed to update session assessors:", error);
                toast.error(`Failed to update session assessors: ${error.message}`);
                refetchSessionOnConflict(error);
            },
            onSuccess() {
                toast.success("Session assessors updated");
                onDone();
            },
        }),
    );

    const assignedPersonIds = new Set(assignedAssessors.map((p) => p.id));
    const eligiblePersonIds = new Set(eligibleAssessors.map((p) => p.id));

    // Eligible ∪ assigned, by name. Assigned-but-ineligible people are listed only so they can be
    // removed; they're never offered to a session that doesn't already have them.
    const candidates = R.pipe(
        [...eligibleAssessors, ...assignedAssessors],
        R.uniqueBy((person) => person.id),
        R.sortBy((person) => person.name),
    );

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

    // Only warn someone who could actually record here: an ineligible self row loses nothing by
    // being removed.
    const isRemovingSelf =
        !!personSelf &&
        canRecordChecks &&
        assignedPersonIds.has(personSelf.id) &&
        !isSelected(personSelf.id);

    return (
        <>
            <DialogBody>
                {isRemovingSelf && (
                    <Alert variant="warning">
                        <AlertTitle>You&apos;re removing yourself</AlertTitle>
                        <AlertDescription>
                            You won&apos;t be able to record checks in this session.
                        </AlertDescription>
                    </Alert>
                )}
                {eligibleAssessors.length === 0 && (
                    <Empty>
                        <EmptyHeader>
                            <EmptyTitle>No eligible assessors</EmptyTitle>
                            <EmptyDescription>
                                Assessors need the Skills Assessor role and an account linked to a
                                person record in this organisation.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}
                {candidates.length > 0 && (
                    <FieldGroup>
                        {candidates.map((person) => (
                            <Field orientation="horizontal" key={person.id}>
                                <Checkbox
                                    id={`assessor-${person.id}`}
                                    checked={isSelected(person.id)}
                                    onCheckedChange={(checked) =>
                                        handleChangeChecked(person.id, checked === true)
                                    }
                                />
                                <FieldContent>
                                    <FieldLabel htmlFor={`assessor-${person.id}`}>
                                        {person.name}
                                    </FieldLabel>
                                    {!eligiblePersonIds.has(person.id) && (
                                        <FieldDescription>
                                            Can&apos;t record checks
                                        </FieldDescription>
                                    )}
                                </FieldContent>
                            </Field>
                        ))}
                    </FieldGroup>
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
