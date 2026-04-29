/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowUpIcon } from "lucide-react";
import { useState } from "react";
import { match, P } from "ts-pattern";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Alert, AlertDescription } from "@/components/ui/alert2";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ObjectName, Paragraph } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_SessionRecord_Record_Tab({ session }: { session: SkillCheckSession }) {
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

    const [selected, setSelected] = useState<{
        personId: PersonId | null;
        skillId: SkillId | null;
    }>({ personId: null, skillId: null });

    return (
        <div className="space-y-4">
            <Card>
                <CardContent>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Person</FieldLabel>
                            <Select
                                value={selected.personId ?? ""}
                                onValueChange={(value) =>
                                    setSelected((s) => ({
                                        ...s,
                                        personId: value != "None" ? (value as PersonId) : null,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            selected.skillId
                                                ? "All personnel"
                                                : "Select a person..."
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent position="item-aligned">
                                    <SelectItem value="None">None</SelectItem>
                                    <SelectSeparator />
                                    {assignedPersonnel.map((person) => (
                                        <SelectItem key={person.id} value={person.id}>
                                            {person.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Skill</FieldLabel>
                            <Select
                                value={selected.skillId ?? ""}
                                onValueChange={(value) =>
                                    setSelected((s) => ({
                                        ...s,
                                        skillId: value != "None" ? (value as SkillId) : null,
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue
                                        placeholder={
                                            selected.personId ? "All skills" : "Select a skill..."
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent position="item-aligned">
                                    <SelectItem value="None">None</SelectItem>
                                    <SelectSeparator />
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
            {match(selected)
                .with({ personId: null, skillId: null }, () => (
                    <Empty>
                        <EmptyMedia>
                            <ArrowUpIcon className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>
                            Select a person and/or skill to assess them.
                        </EmptyDescription>
                    </Empty>
                ))
                .with({ personId: P.nonNullable, skillId: null }, (s) => (
                    <Card>
                        <CardHeader>
                            <CardDescription>
                                Assessing{" "}
                                <ObjectName>
                                    {assignedPersonnel.find((p) => p.id === s.personId)?.name}
                                </ObjectName>
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                {sessionSkills.map((skill) => {
                                    return (
                                        <Field key={skill.id} orientation="responsive">
                                            <FieldLabel>{skill.name}</FieldLabel>
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
                                                    <SelectItem value="Competent">
                                                        Competent
                                                    </SelectItem>
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
                ))
                .with({ personId: null, skillId: P.nonNullable }, (s) => <p>Record by skill</p>)
                .with({ personId: P.nonNullable, skillId: P.nonNullable }, (s) => (
                    <p>Record single.</p>
                ))
                .exhaustive()}
        </div>
    );
}
