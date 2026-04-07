/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@/components/ui/field";

import { useOrganization } from "@/hooks/use-organization";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function SkillsModule_Session_Personnel_Tab({ session }: { session: SkillCheckSession }) {
    const organization = useOrganization();

    const [{ data: teams }, { data: teamMemberships }, { data: assignedPersonnel }] =
        useSuspenseQueries({
            queries: [
                trpc.teams.listTeams.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.teams.listTeamMemberships.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.skills.listSessionAssessees.queryOptions({
                    sessionId: session.id,
                    organizationId: organization.id,
                }),
            ],
        });

    const assignedPersonIds = assignedPersonnel.map((p) => p.id);

    const [changes, setChanges] = useState<Record<PersonId, boolean>>({});

    const addedCount = Object.values(changes).filter((v) => v).length;
    const removedCount = Object.values(changes).filter((v) => !v).length;

    function handleChangeChecked(personId: PersonId, newValue: boolean) {
        const previousValue = assignedPersonIds.includes(personId);

        if (newValue === previousValue) {
            setChanges((c) => {
                const { [personId]: _, ...rest } = c;
                return rest;
            });
        } else {
            setChanges((c) => ({ ...c, [personId]: newValue }));
        }
    }

    function isSelected(personId: PersonId) {
        return changes[personId] ?? assignedPersonIds.includes(personId);
    }

    return (
        <Card>
            <CardContent>
                <FieldSet>
                    <FieldLegend>Personnel to assess</FieldLegend>
                    <FieldDescription>
                        Select the personnel you want to assess in this skill check session.
                    </FieldDescription>

                    {teams
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((team) => {
                            const members = teamMemberships.filter((m) => m.teamId === team.id);
                            const teamSelectedCount = members.filter((m) =>
                                isSelected(m.person.id),
                            ).length;

                            return (
                                <Collapsible key={team.id}>
                                    <CollapsibleTrigger className="group w-full flex items-center px-2 py-1 justify-between transition-none hover:bg-accent hover:text-accent-foreground border-b">
                                        <div className="font-medium">{team.name}</div>
                                        <div className="flex item-center gap-2">
                                            <div className="flex gap-1 text-muted-foreground">
                                                <span>
                                                    {teamSelectedCount}/{members.length}
                                                </span>
                                                <span className="hidden md:inline">selected</span>
                                            </div>
                                            <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                        </div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <FieldGroup className="py-4 px-2">
                                            {members
                                                .sort((a, b) =>
                                                    a.person.name.localeCompare(b.person.name),
                                                )
                                                .map((membership) => (
                                                    <Field
                                                        orientation="horizontal"
                                                        key={membership.id}
                                                    >
                                                        <Checkbox
                                                            id={`membership-${membership.id}`}
                                                            checked={isSelected(
                                                                membership.person.id,
                                                            )}
                                                            onCheckedChange={(checked) => {
                                                                handleChangeChecked(
                                                                    membership.person.id,
                                                                    !!checked,
                                                                );
                                                            }}
                                                        />
                                                        <FieldLabel
                                                            htmlFor={`membership-${membership.id}`}
                                                        >
                                                            {membership.person.name}
                                                        </FieldLabel>
                                                    </Field>
                                                ))}
                                        </FieldGroup>
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        })}
                </FieldSet>
            </CardContent>
        </Card>
    );
}
