/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_SessionRecord_ByPerson_Tab({
    session,
}: {
    session: SkillCheckSession;
}) {
    const organization = useOrganization();

    const [{ data: assignedPersonnel }, { data: skillChecks }, { data: sessionSkills }] =
        useSuspenseQueries({
            queries: [
                trpc.skills.listSessionAssessees.queryOptions({
                    sessionId: session.id,
                    organizationId: organization.id,
                }),
                trpc.skillChecks.listSkillChecks.queryOptions({
                    organizationId: organization.id,
                    sessionId: session.id,
                }),
                trpc.skills.listSessionSkills.queryOptions({
                    sessionId: session.id,
                    organizationId: organization.id,
                }),
            ],
        });

    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

    const [changes, setChanges] = useState<Record<SkillId, { result: string; notes: string }>>({});

    function handleChangeResult(skillId: SkillId, result: string) {
        setChanges((prev) => ({
            ...prev,
            [skillId]: {
                ...prev[skillId],
                result,
            },
        }));
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardContent>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Person</FieldLabel>
                            <Select
                                value={selectedPersonId ?? undefined}
                                onValueChange={(value) => setSelectedPersonId(value ?? null)}
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
                    </FieldGroup>
                </CardContent>
            </Card>
            <Show
                when={selectedPersonId !== null}
                fallback={
                    <Empty>
                        <EmptyMedia>
                            <ArrowUpIcon className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>Select a person to assess their skills.</EmptyDescription>
                    </Empty>
                }
            >
                <Card>
                    <CardHeader>
                        <CardDescription>
                            Assessing{" "}
                            <ObjectName>
                                {
                                    assignedPersonnel.find(
                                        (person) => person.id === selectedPersonId,
                                    )?.name
                                }
                            </ObjectName>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            {sessionSkills.map((skill) => {
                                const savedCheck = skillChecks.find(
                                    (check) =>
                                        check.skillId == skill.id &&
                                        check.assesseeId == selectedPersonId,
                                );
                                const change = changes[skill.id];
                                const currentResult = change ? change.result : savedCheck?.result;
                                const currentNotes = change
                                    ? change.notes
                                    : (savedCheck?.notes ?? "");

                                return (
                                    <Field key={skill.id}>
                                        <FieldLabel>{skill.name}</FieldLabel>
                                        <Select
                                            value={currentResult ?? ""}
                                            onValueChange={(value) =>
                                                handleChangeResult(skill.id, value)
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Not Assessed" />
                                            </SelectTrigger>
                                            <SelectContent position="item-aligned">
                                                <SelectItem value="NotAssessed">
                                                    Not Assessed
                                                </SelectItem>
                                                <SelectSeparator />
                                                <SelectItem value="HighlyConfident">
                                                    Highly Confident
                                                </SelectItem>
                                                <SelectItem value="Competent">Competent</SelectItem>
                                                <SelectItem value="NotYetCompetent">
                                                    Not Yet Competent
                                                </SelectItem>
                                                <SelectItem value="NotTaught">
                                                    Not Taught
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                );
                            })}
                        </FieldGroup>
                    </CardContent>
                </Card>
            </Show>
        </div>
    );
}
