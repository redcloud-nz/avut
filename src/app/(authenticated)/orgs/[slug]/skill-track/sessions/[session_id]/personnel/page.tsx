/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/personnel
 */

"use client";

import { ChevronDownIcon } from "lucide-react";
import { use, useState } from "react";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
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

import { skillsInvalidations } from "@/client/skills-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { TeamData } from "@/lib/schemas/team";
import { TeamMembershipData } from "@/lib/schemas/team-membership";
import { trpc } from "@/trpc/client";

/**
 * Page for selecting personnel to be assessed in a skill check session.
 * Displays a list of teams, each containing its members with checkboxes to select/deselect them for the session.
 * Changes are saved automatically with a debounce, and the UI indicates pending changes and errors.
 */
export default function SkillTrack_SessionPersonnel_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/personnel">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const [
        { data: assignedPersonnel },
        { data: session },
        { data: teams },
        { data: teamMemberships },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.listSessionAssessees.queryOptions({
                sessionId: session_id,
                organizationId: organization.id,
                scope: "assigned",
            }),
            trpc.skills.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: session_id,
            }),
            trpc.teams.listTeams.queryOptions({
                organizationId: organization.id,
            }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const mutation = useMutation(
        trpc.skills.updateSessionAssessees.mutationOptions({
            meta: { invalidates: skillsInvalidations.updateSessionAssessees },
            onError(error) {
                console.error("Failed to update session assessees:", error);
                toast.error(`Failed to update session assessees. ${error.message}`);
            },
            onSuccess({ updatedAssessees, updatedSession }, _variables, _onMutateResult, context) {
                setChanges({});

                // Update the cached assessees and session data with the response from the server
                context.client.setQueryData(
                    trpc.skills.listSessionAssessees.queryKey({
                        sessionId: session_id,
                        organizationId: organization.id,
                        scope: "assigned",
                    }),
                    updatedAssessees,
                );
                context.client.setQueryData(
                    trpc.skills.getSession.queryKey({
                        organizationId: organization.id,
                        skillCheckSessionId: session_id,
                    }),
                    (old) => (old ? { ...old, ...updatedSession } : old),
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

    return (
        <Std.SidebarInset>
            <Std.Navbar>
                <Std.Breadcrumbs
                    breadcrumbs={[
                        { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                        {
                            label: "Sessions",
                            href: route("/orgs/[slug]/skill-track/sessions", { slug }),
                        },
                        {
                            label: session.name,
                            href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                                slug,
                                session_id,
                            }),
                        },
                        "Personnel",
                    ]}
                />
                <div className="flex justify-end grow">
                    <SaveStatusIndicator status={mutation.status} />
                </div>
            </Std.Navbar>
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Session Personnel</Saratoga.Title>
                    </Saratoga.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Personnel to assess</CardTitle>
                            <CardDescription>
                                Select the personnel you want to assess in this skill check session.
                                Changes will be saved automatically.
                            </CardDescription>
                            <CardAction className="flex flex-col items-center">
                                <div className="text-lg font-medium">
                                    {assignedPersonIds.length}
                                </div>
                                <div className="text-muted-foreground">selected</div>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldSet>
                                {teams
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((team) => (
                                        <TeamSection
                                            key={team.id}
                                            team={team}
                                            members={teamMemberships.filter(
                                                (m) => m.teamId === team.id,
                                            )}
                                            assignedPersonIds={assignedPersonIds}
                                            changes={changes}
                                            onChangeChecked={handleChangeChecked}
                                        />
                                    ))}
                            </FieldSet>
                        </CardContent>
                    </Card>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}

interface TeamSectionProps {
    assignedPersonIds: PersonId[];
    changes: Record<PersonId, boolean>;
    members: (TeamMembershipData & { person: PersonRef })[];
    team: TeamData;
    onChangeChecked: (personId: PersonId, newValue: boolean) => void;
}

/**
 * Team section of the personnel selection page.
 * Displays a collapsible section for a team, showing its members with checkboxes to select/deselect them for the skill check session.
 * Also shows the count of selected members in the team and indicates changes with +1/-1.
 */
function TeamSection({
    assignedPersonIds,
    changes,
    onChangeChecked,
    members,
    team,
}: TeamSectionProps) {
    function isSelected(personId: PersonId) {
        return changes[personId] ?? assignedPersonIds.includes(personId);
    }

    const teamSelectedCount = members.filter((m) => isSelected(m.person.id)).length;

    return (
        <Collapsible key={team.id}>
            <CollapsibleTrigger className="group w-full flex items-center px-2 py-1 justify-between transition-none hover:bg-accent hover:text-accent-foreground border-b">
                <div className="font-medium">{team.name}</div>
                <div className="flex item-center gap-2">
                    <div className="flex gap-1 text-muted-foreground">
                        <span>
                            {teamSelectedCount} of {members.length}
                        </span>
                        <span className="hidden md:inline">selected</span>
                    </div>
                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <FieldGroup className="py-4 px-2">
                    {members
                        .sort((a, b) => a.person.name.localeCompare(b.person.name))
                        .map((membership) => (
                            <Field orientation="horizontal" key={membership.id}>
                                <Checkbox
                                    id={`membership-${membership.id}`}
                                    checked={isSelected(membership.person.id)}
                                    onCheckedChange={(checked) =>
                                        onChangeChecked(membership.person.id, !!checked)
                                    }
                                />
                                <FieldLabel htmlFor={`membership-${membership.id}`}>
                                    {membership.person.name}
                                </FieldLabel>
                                {changes[membership.person.id] === true && (
                                    <div className="leading-snug text-green-500">+1</div>
                                )}
                                {changes[membership.person.id] === false && (
                                    <div className="leading-snug text-red-500">-1</div>
                                )}
                            </Field>
                        ))}
                </FieldGroup>
            </CollapsibleContent>
        </Collapsible>
    );
}
