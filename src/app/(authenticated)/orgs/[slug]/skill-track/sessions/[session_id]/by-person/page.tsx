/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/by-person
 */

"use client";

import { ArrowLeftIcon, ArrowUpIcon, ChevronRightIcon } from "lucide-react";
import { use, useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Show } from "@/components/show";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { SaveStatusIndicator } from "@/components/ui/save-status-indicator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

import { SkillTrack_AssessmentRow } from "../assessment-row";

export default function SkillTrack_SessionByPerson_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/by-person">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();
    const queryClient = useQueryClient();

    const skillChecksQueryOptions = trpc.skillChecks.listSkillChecks.queryOptions({
        organizationId: organization.id,
        sessionId: session_id,
        ownChecksOnly: true,
    });

    const [
        { data: session },
        { data: assignedPersonnel },
        { data: skillChecks },
        { data: sessionSkills },
        { data: personSelf },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: session_id,
            }),
            trpc.skills.listSessionAssessees.queryOptions({
                sessionId: session_id,
                organizationId: organization.id,
                scope: "assigned",
            }),
            skillChecksQueryOptions,
            trpc.skills.listSessionSkills.queryOptions({
                sessionId: session_id,
                organizationId: organization.id,
                scope: "assigned",
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
            sessionId: session_id,
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
                            label: session.name || session.id,
                            href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                                slug,
                                session_id,
                            }),
                        },
                        "By Person",
                    ]}
                />
                <div className="flex justify-end grow">
                    <SaveStatusIndicator status={mutation.status} />
                </div>
            </Std.Navbar>
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Assess by Person</Saratoga.Title>
                    </Saratoga.Header>
                    {/* <Card>
                        <CardContent> */}
                    <Show
                        when={!!personSelf}
                        fallback={
                            <Alert variant="warning">
                                <AlertTitle>No linked person record</AlertTitle>
                                <AlertDescription>
                                    Your account is not linked to a person record in this
                                    organization. Contact an administrator to link your account
                                    before recording skill checks.
                                </AlertDescription>
                            </Alert>
                        }
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_2fr] gap-4">
                            <div>
                                <FieldGroup className="block lg:hidden">
                                    <Field>
                                        <FieldLabel>Person</FieldLabel>
                                        <Select
                                            value={selectedPersonId ?? "undefined"}
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
                                </FieldGroup>
                                <ItemGroup className="hidden lg:block">
                                    {assignedPersonnel.map((person) => (
                                        <Item
                                            key={person.id}
                                            asChild
                                            variant={
                                                person.id === selectedPersonId
                                                    ? "outline"
                                                    : "default"
                                            }
                                        >
                                            <a
                                                onClick={() => {
                                                    mutation.reset();
                                                    setSelectedPersonId(person.id);
                                                }}
                                            >
                                                <ItemContent>
                                                    <ItemTitle>{person.name}</ItemTitle>
                                                </ItemContent>

                                                <ItemActions>
                                                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                                                </ItemActions>
                                            </a>
                                        </Item>
                                    ))}
                                </ItemGroup>
                            </div>
                            <Separator orientation="vertical" className="hidden lg:block" />
                            <Separator orientation="horizontal" className="block lg:hidden" />
                            <div>
                                <FieldGroup>
                                    <Show
                                        when={selectedPersonId !== null}
                                        fallback={
                                            <Empty>
                                                <EmptyMedia>
                                                    <ArrowLeftIcon className="hidden lg:block size-12 text-muted-foreground" />
                                                    <ArrowUpIcon className="block lg:hidden size-12 text-muted-foreground" />
                                                </EmptyMedia>
                                                <EmptyDescription>
                                                    Select a person to assess their skills.
                                                </EmptyDescription>
                                            </Empty>
                                        }
                                    >
                                        {sessionSkills.map((skill) => (
                                            <SkillTrack_AssessmentRow
                                                key={skill.id}
                                                title={skill.name}
                                                value={getCurrentValue(selectedPersonId!, skill.id)}
                                                onValueChange={(newValue) =>
                                                    handleChange(skill.id, newValue)
                                                }
                                            />
                                        ))}
                                    </Show>
                                </FieldGroup>
                            </div>
                        </div>
                    </Show>
                    {/* </CardContent>
                    </Card> */}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
