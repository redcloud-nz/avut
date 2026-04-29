/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/personnel
 */

"use client";

import { ChevronDownIcon } from "lucide-react";
import { use, useState } from "react";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export default function SkillModule_SessionPersonnel_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]/personnel">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const [
        { data: assignedPersonnel },
        { data: sessions },
        { data: teams },
        { data: teamMemberships },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.listSessionAssessees.queryOptions({
                sessionId: session_id,
                organizationId: organization.id,
            }),
            trpc.skills.listSessions.queryOptions({ organizationId: organization.id }),
            trpc.teams.listTeams.queryOptions({
                organizationId: organization.id,
            }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });
    const session = sessions.find((s) => s.id === session_id);
    if (!session) throw new Error(`Session(${session_id}) not found`);

    const mutation = useMutation(
        trpc.skills.updateSessionAssessees.mutationOptions({
            onError(error) {
                console.error("Failed to update session assessees:", error);
                toast.error(`Failed to update session assessees. ${error.message}`);
            },
            onSuccess({ updated }, _variables, _onMutateResult, context) {
                toast.success("Session personnel updated.");

                setChanges({});

                context.client.setQueryData(
                    trpc.skills.listSessionAssessees.queryKey({
                        sessionId: session_id,
                        organizationId: organization.id,
                    }),
                    updated,
                );
            },
        }),
    );

    const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

    // A record of changes made by the user in the current session. The keys are person IDs, and the values indicate whether the person is now selected (true) or deselected (false).
    const [changes, setChanges] = useState<Record<PersonId, boolean>>({});

    // The IDs of the personnel currently assigned to the session, used as the baseline for tracking changes.
    const assignedPersonIds = assignedPersonnel.map((p) => p.id);

    function handleChangeChecked(personId: PersonId, newValue: boolean) {
        if (mutation.status == "success") {
            mutation.reset();
        }

        const previousValue = assignedPersonIds.includes(personId);

        let updatedChanges: typeof changes;
        if (newValue === previousValue) {
            const { [personId]: _, ...rest } = changes;
            updatedChanges = rest;
        } else {
            updatedChanges = { ...changes, [personId]: newValue };
        }
        setChanges(updatedChanges);

        debouncer.maybeExecute({
            organizationId: organization.id,
            skillCheckSessionId: session_id,
            addedPersonIds: Object.entries(updatedChanges)
                .filter(([_, selected]) => selected)
                .map(([id, _]) => id as PersonId),
            removedPersonIds: Object.entries(updatedChanges)
                .filter(([_, selected]) => !selected)
                .map(([id, _]) => id as PersonId),
        });
    }

    /**
     * Determines whether a given person is currently selected.
     */
    function isSelected(personId: PersonId) {
        return changes[personId] ?? assignedPersonIds.includes(personId);
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    {
                        label: session.name,
                        href: route("/main/[slug]/skills/sessions/[session_id]", {
                            slug,
                            session_id,
                        }),
                    },
                    "Personnel",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/skills/sessions/[session_id]", {
                                slug,
                                session_id,
                            })}
                        />
                        <Hermes.Title>Session Personnel</Hermes.Title>
                    </Hermes.Header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Personnel to assess</CardTitle>
                            <CardDescription>
                                Select the personnel you want to assess in this skill check session.
                                Changes will be saved automatically.
                            </CardDescription>
                            <CardAction>
                                <SaveStatusIndicator status={mutation.status} />
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldSet>
                                {teams
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((team) => {
                                        const members = teamMemberships.filter(
                                            (m) => m.teamId === team.id,
                                        );
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
                                                            <span className="hidden md:inline">
                                                                selected
                                                            </span>
                                                        </div>
                                                        <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                                    </div>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <FieldGroup className="py-4 px-2">
                                                        {members
                                                            .sort((a, b) =>
                                                                a.person.name.localeCompare(
                                                                    b.person.name,
                                                                ),
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
                                                                        onCheckedChange={(
                                                                            checked,
                                                                        ) => {
                                                                            handleChangeChecked(
                                                                                membership.person
                                                                                    .id,
                                                                                !!checked,
                                                                            );
                                                                        }}
                                                                    />
                                                                    <FieldLabel
                                                                        htmlFor={`membership-${membership.id}`}
                                                                    >
                                                                        {membership.person.name}
                                                                    </FieldLabel>
                                                                    {changes[
                                                                        membership.person.id
                                                                    ] === true && (
                                                                        <div className="leading-snug text-green-500">
                                                                            +1
                                                                        </div>
                                                                    )}
                                                                    {changes[
                                                                        membership.person.id
                                                                    ] === false && (
                                                                        <div className="leading-snug text-red-500">
                                                                            -1
                                                                        </div>
                                                                    )}
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
