/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Card, CardContent } from "@/components/ui/card";
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

import { useOrganization } from "@/hooks/use-organization";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_SessionRecord_BySkill_Tab({
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

    const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

    return (
        <div className="space-y-4">
            <Card>
                <CardContent>
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Skill</FieldLabel>
                            <Select
                                value={selectedSkillId ?? undefined}
                                onValueChange={(value) => setSelectedSkillId(value ?? null)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a skill" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sessionSkills.map((skill) => (
                                        <SelectItem key={skill.id} value={skill.id}>
                                            {skill.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
            <Show
                when={selectedSkillId !== null}
                fallback={
                    <Empty>
                        <EmptyMedia>
                            <ArrowUpIcon className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>Select a skill to assess personnel.</EmptyDescription>
                    </Empty>
                }
            >
                <Card>
                    <CardContent>
                        <FieldGroup>
                            {assignedPersonnel.map((person) => {
                                return (
                                    <Field key={person.id}>
                                        <FieldLabel>{person.name}</FieldLabel>
                                        <Select>
                                            <SelectTrigger>
                                                <SelectValue />
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
