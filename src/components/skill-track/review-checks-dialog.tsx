/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { useRefetchSessionOnConflict } from "@/components/skill-track/use-refetch-session-on-conflict";
import { Alert } from "@/components/ui/alert";
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
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import {
    assessorDisplayName,
    getSkillCheckResultLabel,
    SkillCheck,
    SkillCheckId,
} from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { isCheckIncluded } from "@/lib/skill-check-conflicts";
import { trpc } from "@/trpc/client";

/** Whose checks the dialog shows: one assessee's, or one skill's. */
export type ReviewChecksSubject = { kind: "person"; id: PersonId } | { kind: "skill"; id: SkillId };

/**
 * One person's (or one skill's) checks in a session, where each can be excluded from the
 * approval or included again. Saves through `updateCheckExclusions`.
 *
 * A nested-entity mutation dialog, host-driven: the review page owns
 * `?action=review-person&personId=…` / `?action=review-skill&skillId=…`, resolves the subject's
 * checks, and renders this only once they resolve.
 *
 * The draft holds only the checks ticked or unticked since the dialog opened; every other check
 * shows its saved status. So a refetch (after a save elsewhere, or a `CONFLICT`) moves the
 * untouched checks along with it, and Save never writes back a check nobody touched here. The
 * draft resets on open and on a switch to another subject, so Back/Forward between two people
 * doesn't carry one's draft into the other. A conflict's checks are read-only: their pick is made
 * in the Conflicts card.
 */
export function SkillsModule_ReviewChecks_Dialog({
    sessionId,
    subject,
    title,
    description,
    rows,
    assessorById,
    conflictCheckIds,
    readOnly,
    onSaved,
    ...props
}: ComponentProps<typeof Dialog> & {
    sessionId: SkillCheckSessionId;
    subject: ReviewChecksSubject;
    title: string;
    description: string;
    /** The subject's checks, in display order, each labelled with the other side's name. */
    rows: { check: SkillCheck; label: string }[];
    assessorById: Map<PersonId, PersonRef>;
    /** The checks in a conflict group: shown, but not changeable here. */
    conflictCheckIds: ReadonlySet<SkillCheckId>;
    /** The session is approved or the viewer can't approve: no Save, the checkboxes are disabled. */
    readOnly: boolean;
    /**
     * A save for `subject` succeeded. The host closes the dialog only if the URL still names that
     * subject, so a late save doesn't close whatever is open by then.
     */
    onSaved(subject: ReviewChecksSubject): void;
}) {
    const organization = useOrganization();

    // Excluded or not, for each check changed since the dialog opened.
    const [draft, setDraft] = useState<ReadonlyMap<SkillCheckId, boolean>>(() => new Map());

    const savedExcluded = (check: SkillCheck) => !isCheckIncluded(check);
    const isEditable = (check: SkillCheck) => !readOnly && !conflictCheckIds.has(check.id);
    const isExcluded = (check: SkillCheck) =>
        isEditable(check) ? (draft.get(check.id) ?? savedExcluded(check)) : savedExcluded(check);

    // What Save sends: the editable checks still here whose draft differs from their saved status.
    const changes = rows
        .filter(({ check }) => isEditable(check) && isExcluded(check) !== savedExcluded(check))
        .map(({ check }) => ({ skillCheckId: check.id, excluded: isExcluded(check) }));

    const refetchSessionOnConflict = useRefetchSessionOnConflict(sessionId);
    const mutation = useMutation(
        trpc.skillCheckSessions.updateCheckExclusions.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateCheckExclusions },
            onError(error) {
                console.error("Failed to save the review decisions:", error);
                // A toast as well as the in-dialog alert: the refetch can unmount the dialog (the
                // subject's checks are gone), taking the alert with it.
                toast.error(`Failed to save: ${error.message}`);
                refetchSessionOnConflict(error);
            },
            onSuccess() {
                toast.success("Changes saved");
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            setDraft(new Map());
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on open, or on a switch to another subject
    }, [props.open, subject.kind, subject.id]);

    function toggle(check: SkillCheck) {
        setDraft((prev) =>
            new Map(prev).set(check.id, !(prev.get(check.id) ?? savedExcluded(check))),
        );
    }

    function handleSave() {
        if (changes.length === 0) return;
        // The subject this save is for: by the time it lands, Back/Forward may have moved the
        // dialog to another one, which the host then leaves open.
        const savedSubject = subject;
        mutation.mutate(
            { organizationId: organization.id, sessionId, changes },
            { onSuccess: () => onSaved(savedSubject) },
        );
    }

    return (
        <Dialog {...props}>
            <DialogContent size="lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4">
                    <ul className="flex flex-col gap-3">
                        {rows.map(({ check, label }) => (
                            <CheckRow
                                key={check.id}
                                check={check}
                                label={label}
                                included={!isExcluded(check)}
                                inConflict={conflictCheckIds.has(check.id)}
                                disabled={!isEditable(check) || mutation.isPending}
                                assessor={
                                    check.assessorId
                                        ? (assessorById.get(check.assessorId) ?? null)
                                        : null
                                }
                                onToggle={() => toggle(check)}
                            />
                        ))}
                    </ul>
                    {mutation.error && <Alert variant="error">{mutation.error.message}</Alert>}
                </DialogBody>
                {readOnly ? (
                    <DialogFooter showCloseButton />
                ) : (
                    <DialogFooter>
                        <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        <MutationButton
                            type="button"
                            status={mutation.status}
                            disabled={changes.length === 0}
                            text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                            onClick={handleSave}
                        />
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}

function CheckRow({
    check,
    label,
    included,
    inConflict,
    disabled,
    assessor,
    onToggle,
}: {
    check: SkillCheck;
    /** The skill's name in a person's dialog, the assessee's in a skill's. */
    label: string;
    included: boolean;
    inConflict: boolean;
    disabled: boolean;
    assessor: PersonRef | null;
    onToggle(): void;
}) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();
    const checkboxId = `check-${check.id}`;

    return (
        <li className="flex items-start gap-3">
            <Checkbox
                id={checkboxId}
                className="mt-0.5"
                checked={included}
                disabled={disabled}
                onCheckedChange={onToggle}
            />
            <div className="flex min-w-0 grow flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Label htmlFor={checkboxId} className="leading-snug">
                        {label}
                    </Label>
                    <span>{getSkillCheckResultLabel(organization.settings, check.result)}</span>
                </div>
                <div className="text-muted-foreground">
                    {assessorDisplayName({ assessor, assessorLabel: check.assessorLabel })} ·{" "}
                    {formatDateTime(check.recordedAt)}
                    {inConflict && " · picked in Conflicts"}
                </div>
                {check.notes && (
                    <p className="wrap-break-word whitespace-pre-wrap">{check.notes}</p>
                )}
            </div>
        </li>
    );
}
