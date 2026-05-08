/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert2";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldSeparator } from "@/components/ui/field";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

import { AssessmentRow } from "./assessment-row";

/**
 * Tab for recording skill checks for a single person within a session. Changes are automatically saved with a debounce, and the save status is indicated in the header.
 */
export function SkillsModule_SessionRecord_ByPerson_Tab({
    session,
}: {
    session: SkillCheckSession;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const skillChecksQueryOptions = trpc.skillChecks.listSkillChecks.queryOptions({
        organizationId: organization.id,
        sessionId: session.id,
        ownChecksOnly: true,
    });

    const [
        { data: assignedPersonnel },
        { data: skillChecks },
        { data: sessionSkills },
        { data: personSelf },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.listSessionAssessees.queryOptions({
                sessionId: session.id,
                organizationId: organization.id,
            }),
            skillChecksQueryOptions,
            trpc.skills.listSessionSkills.queryOptions({
                sessionId: session.id,
                organizationId: organization.id,
            }),
            trpc.personnel.getPersonSelf.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const mutation = useMutation(
        trpc.skillChecks.upsertSessionSkillChecks.mutationOptions({
            onError(error) {
                console.error("Failed to save skill check changes:", error);
                toast.error(`Failed to save changes: ${error.message}`);
            },
            onSuccess({ created, updated, deleted }, variables) {
                // Surgically remove only changes whose values still match what was sent.
                // If the user edited a skill again while the mutation was in flight, the
                // current value will differ from what we sent — leave those entries alone.
                setChanges((prev) => {
                    const next = { ...prev };
                    for (const u of variables.updates) {
                        const key = `${u.assesseeId}::${u.skillId}` as `${PersonId}::${SkillId}`;
                        const current = next[key];
                        if (current?.result === u.result && current?.notes === u.notes) {
                            delete next[key];
                        }
                    }
                    return next;
                });

                // Surgically update the query cache from the returned records.
                queryClient.setQueryData(skillChecksQueryOptions.queryKey, (old) => {
                    if (!old) return old;

                    const deletedKeys = new Set(
                        deleted.map((d) => `${d.assesseeId}::${d.skillId}`),
                    );
                    const updatedMap = new Map(
                        updated.map((c) => [`${c.assesseeId}::${c.skillId}`, c]),
                    );

                    const result = old
                        .filter((c) => !deletedKeys.has(`${c.assesseeId}::${c.skillId}`))
                        .map((c) => updatedMap.get(`${c.assesseeId}::${c.skillId}`) ?? c);

                    return [...result, ...created];
                });
            },
        }),
    );

    const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

    const [selectedPersonId, setSelectedPersonId] = useState<PersonId | null>(null);

    // Keyed by `${personId}::${skillId}` — scoping by person prevents cross-person contamination
    // when switching between assessees while changes are pending.
    const [changes, setChanges] = useState<
        Record<`${PersonId}::${SkillId}`, { result: string; notes: string }>
    >({});

    function handleChange(skillId: SkillId, newValue: { result: string; notes: string }) {
        if (mutation.status === "success") mutation.reset();

        const key = `${selectedPersonId!}::${skillId}`;
        const updatedChanges: typeof changes = { ...changes, [key]: newValue };
        setChanges(updatedChanges);

        debouncer.maybeExecute({
            organizationId: organization.id,
            sessionId: session.id,
            updates: R.entries(updatedChanges).map(([k, { result, notes }]) => {
                const [assesseeId, sid] = k.split("::") as [PersonId, SkillId];
                return { assesseeId, skillId: sid, result, notes };
            }),
        });
    }

    function getCurrentValue(assesseeId: PersonId, skillId: SkillId) {
        const change = changes[`${assesseeId}::${skillId}`];
        if (change) return change;

        const savedCheck = skillChecks.find(
            (check) => check.skillId == skillId && check.assesseeId == assesseeId,
        );
        return {
            result: savedCheck?.result ?? "NotAssessed",
            notes: savedCheck?.notes ?? "",
        };
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Assess</CardTitle>
                <CardAction>
                    <SaveStatusIndicator status={mutation.status} />
                </CardAction>
            </CardHeader>
            <CardContent>
                <Show
                    when={!!personSelf}
                    fallback={
                        <Alert variant="warning">
                            <AlertTitle>No linked person record</AlertTitle>
                            <AlertDescription>
                                Your account is not linked to a person record in this organization.
                                Contact an administrator to link your account before recording skill
                                checks.
                            </AlertDescription>
                        </Alert>
                    }
                >
                    <FieldGroup className={!personSelf ? "hidden" : undefined}>
                        <Field>
                            <Select
                                value={selectedPersonId ?? undefined}
                                onValueChange={(value) => {
                                    mutation.reset();
                                    setSelectedPersonId(value as PersonId);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a person" />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignedPersonnel.map((person) => (
                                        <SelectItem key={person.id} value={person.id}>
                                            {person.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <FieldSeparator />

                        <Show
                            when={selectedPersonId !== null}
                            fallback={
                                <Empty>
                                    <EmptyMedia>
                                        <ArrowUpIcon className="size-12 text-muted-foreground" />
                                    </EmptyMedia>
                                    <EmptyDescription>
                                        Select a person to assess their skills.
                                    </EmptyDescription>
                                </Empty>
                            }
                        >
                            {sessionSkills.map((skill) => (
                                <AssessmentRow
                                    key={skill.id}
                                    title={skill.name}
                                    value={getCurrentValue(selectedPersonId!, skill.id)}
                                    onValueChange={(newValue) => handleChange(skill.id, newValue)}
                                />
                            ))}
                        </Show>
                    </FieldGroup>
                </Show>
            </CardContent>
        </Card>
    );
}
