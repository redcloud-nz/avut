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
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import {
    assessorDisplayName,
    getSkillCheckResultLabel,
    SkillCheck,
    SkillCheckId,
} from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { isCheckIncluded, SkillCheckConflict } from "@/lib/skill-check-conflicts";
import { trpc } from "@/trpc/client";

/** The radio value for excluding every check in the conflict. Never a check id (those are nanoids). */
const EXCLUDE_ALL = "exclude-all";

type Choice = SkillCheckId | typeof EXCLUDE_ALL;

/**
 * The saved resolution of a conflict: its one included check, `EXCLUDE_ALL` when every check is
 * excluded, or `null` while it's unresolved (more than one included).
 */
function savedChoice(checks: SkillCheck[]): Choice | null {
    const included = checks.filter(isCheckIncluded);
    if (included.length === 0) return EXCLUDE_ALL;
    if (included.length === 1) return included[0].id;
    return null;
}

/**
 * Resolve one conflict (an assessee and skill with more than one live check): pick the check the
 * approval includes, or exclude them all. Saves through `updateCheckExclusions`.
 *
 * A nested-entity mutation dialog, host-driven: the review page owns
 * `?action=resolve&personId=…&skillId=…`, resolves the conflict from its checks, and renders this
 * only once it does. The choice starts on the saved state and resets on open and whenever the
 * conflict changes, so Back/Forward between two conflicts doesn't carry one's choice into the other.
 */
export function SkillsModule_ResolveConflict_Dialog({
    sessionId,
    conflict,
    assesseeName,
    skillName,
    assessorById,
    onResolved,
    ...props
}: ComponentProps<typeof Dialog> & {
    sessionId: SkillCheckSessionId;
    conflict: SkillCheckConflict<SkillCheck>;
    assesseeName: string;
    skillName: string;
    assessorById: Map<PersonId, PersonRef>;
    /**
     * A save for `conflict` succeeded. The host closes the dialog only if the URL still names that
     * conflict, so a late save doesn't close whatever is open by then.
     */
    onResolved(conflict: SkillCheckConflict<SkillCheck>): void;
}) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const [choice, setChoice] = useState<Choice | null>(() => savedChoice(conflict.checks));
    const saved = savedChoice(conflict.checks);
    // The choice as it stands against the current checks: a picked check that has gone since (a
    // refetch after a `CONFLICT` can drop a deleted one) counts as no choice, rather than letting
    // Save exclude everything.
    const effectiveChoice =
        choice === EXCLUDE_ALL || conflict.checks.some((check) => check.id === choice)
            ? choice
            : null;

    const refetchSessionOnConflict = useRefetchSessionOnConflict(sessionId);
    const mutation = useMutation(
        trpc.skillCheckSessions.updateCheckExclusions.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateCheckExclusions },
            onError(error) {
                console.error("Failed to resolve conflict:", error);
                // A toast as well as the in-dialog alert: the refetch can unmount the dialog (the
                // conflict is gone), taking the alert with it.
                toast.error(`Failed to resolve conflict: ${error.message}`);
                refetchSessionOnConflict(error);
            },
            onSuccess() {
                toast.success("Conflict resolved");
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            setChoice(savedChoice(conflict.checks));
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on open, or on a switch to another conflict
    }, [props.open, conflict.key]);

    function handleSave() {
        if (effectiveChoice === null) return;
        // The conflict this save is for: by the time it lands, Back/Forward may have moved the
        // dialog to another one, which the host then leaves open.
        const savedConflict = conflict;
        mutation.mutate(
            {
                organizationId: organization.id,
                sessionId,
                changes: conflict.checks.map((check) => ({
                    skillCheckId: check.id,
                    excluded: check.id !== effectiveChoice,
                })),
            },
            { onSuccess: () => onResolved(savedConflict) },
        );
    }

    return (
        <Dialog {...props}>
            <DialogContent size="xl">
                <DialogHeader>
                    <DialogTitle>
                        {assesseeName} · {skillName}
                    </DialogTitle>
                    <DialogDescription>
                        Pick the check to include in the approval, or exclude them all.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4">
                    <RadioGroup
                        aria-label={`Resolution for ${assesseeName} · ${skillName}`}
                        value={effectiveChoice ?? ""}
                        onValueChange={(value) => {
                            if (value === EXCLUDE_ALL) setChoice(EXCLUDE_ALL);
                            else {
                                const check = conflict.checks.find((c) => c.id === value);
                                if (check) setChoice(check.id);
                            }
                        }}
                        disabled={mutation.isPending}
                        className="gap-3"
                    >
                        {/* Side by side from `md`, like a merge tool's panes. `auto-fit` gives two
                            checks half the width each and three a third, and wraps a larger group
                            onto further rows of equal-height panes. */}
                        <div className="grid gap-2 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
                            {conflict.checks.map((check) => {
                                const assessor = check.assessorId
                                    ? (assessorById.get(check.assessorId) ?? null)
                                    : null;
                                const radioId = `resolve-${check.id}`;
                                const detailsId = `resolve-${check.id}-details`;
                                return (
                                    <div
                                        key={check.id}
                                        className="flex flex-col overflow-hidden rounded-lg border has-data-checked:border-primary/40 has-data-checked:bg-primary/5 dark:has-data-checked:border-primary/30 dark:has-data-checked:bg-primary/10"
                                    >
                                        <Field
                                            orientation="horizontal"
                                            className="border-b bg-muted/40 px-3 py-2"
                                        >
                                            <RadioGroupItem
                                                value={check.id}
                                                id={radioId}
                                                aria-describedby={detailsId}
                                            />
                                            <FieldLabel
                                                htmlFor={radioId}
                                                className="flex grow flex-wrap justify-between gap-x-3"
                                            >
                                                <span className="font-medium">
                                                    {getSkillCheckResultLabel(
                                                        organization.settings,
                                                        check.result,
                                                    )}
                                                </span>
                                                <span className="font-normal text-muted-foreground">
                                                    {assessorDisplayName({
                                                        assessor,
                                                        assessorLabel: check.assessorLabel,
                                                    })}
                                                </span>
                                            </FieldLabel>
                                        </Field>
                                        <div
                                            id={detailsId}
                                            className="flex flex-col gap-1 px-3 py-2 text-sm"
                                        >
                                            <span className="text-muted-foreground">
                                                {formatDateTime(check.recordedAt)}
                                            </span>
                                            {check.notes && (
                                                <p className="whitespace-pre-wrap">{check.notes}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="rounded-lg border has-data-checked:border-primary/40 has-data-checked:bg-primary/5 dark:has-data-checked:border-primary/30 dark:has-data-checked:bg-primary/10">
                            <Field orientation="horizontal" className="px-3 py-2">
                                <RadioGroupItem
                                    value={EXCLUDE_ALL}
                                    id={`resolve-${conflict.key}-exclude-all`}
                                />
                                <FieldLabel htmlFor={`resolve-${conflict.key}-exclude-all`}>
                                    Exclude all
                                </FieldLabel>
                            </Field>
                        </div>
                    </RadioGroup>
                    {mutation.error && <Alert variant="error">{mutation.error.message}</Alert>}
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        disabled={effectiveChoice === null || effectiveChoice === saved}
                        text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                        onClick={handleSave}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
