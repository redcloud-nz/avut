/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/by-person
 */

"use client";

import {
    ArrowDownAZIcon,
    ArrowLeftIcon,
    ArrowUpIcon,
    ChevronRightIcon,
    ListTreeIcon,
} from "lucide-react";
import { use, useState } from "react";
import * as R from "remeda";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Show } from "@/components/show";
import { SkillTrack_AssessmentRow } from "@/components/skill-track/assessment-row";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RainbowSpinner } from "@/components/ui/loading";
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
        {
            data: { skills: assessableSkills, skillGroups, skillPackages },
        },
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
            trpc.skills.listAssessableSkills.queryOptions({
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

    const isAssignedAssessor =
        !!personSelf && session.assessors.some((assessor) => assessor.id === personSelf.id);

    const debouncer = useDebouncer(mutation.mutate, { wait: 2000 });

    type Selected = { personId: PersonId; status: "Loading" | "Selected" } | null;
    const [selected, setSelected] = useState<Selected>(null);

    async function handleSwitchPerson(personId: PersonId) {
        mutation.reset();
        setSelected({ personId, status: "Loading" });
        await new Promise((resolve) => setTimeout(resolve, 200));

        setSelected({ personId, status: "Selected" });
    }

    // Keyed by `${personId}::${skillId}` — scoping by person prevents cross-person contamination
    // when switching between assessees while changes are pending.
    const [changes, setChanges] = useState<
        Record<`${PersonId}::${SkillId}`, { result: string; notes: string }>
    >({});

    function handleChange(skillId: SkillId, newValue: { result: string; notes: string }) {
        if (mutation.status === "success") mutation.reset();

        const key = `${selected!.personId}::${skillId}`;
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

    const [skillOrder, setSkillOrder] = useState<"alphabetical" | "by-package-group">(
        "alphabetical",
    );
    const [showSkillDescription, setShowSkillDescription] = useState(false);

    // Group the session skills by skill package and group (for the "by-package-group" order).
    // Packages are sorted by name, groups by sequence; skills keep the alphabetical order of
    // `sessionSkills`. Packages/groups with no session skills are omitted.
    const assessableSkillById = new Map(assessableSkills.map((skill) => [skill.id, skill]));
    const packageSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.map((skillPackage) => ({
            skillPackage,
            groups: R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.map((skillGroup) => ({
                    skillGroup,
                    skills: sessionSkills.filter(
                        (skill) =>
                            assessableSkillById.get(skill.id)?.skillGroupId === skillGroup.id,
                    ),
                })),
                R.filter(({ skills }) => skills.length > 0),
            ),
        })),
        R.filter(({ groups }) => groups.length > 0),
    );

    // Session skills that are no longer in the assessable set (e.g. subscription removed).
    const ungroupedSkills = sessionSkills.filter((skill) => !assessableSkillById.has(skill.id));

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
                        <Saratoga.Actions>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Skill Order</DropdownMenuLabel>
                                        <DropdownMenuRadioGroup
                                            value={skillOrder}
                                            onValueChange={(value) =>
                                                setSkillOrder(value as typeof skillOrder)
                                            }
                                        >
                                            <DropdownMenuRadioItem value="alphabetical">
                                                <ArrowDownAZIcon />
                                                <span>Alphabetical</span>
                                            </DropdownMenuRadioItem>
                                            <DropdownMenuRadioItem value="by-package-group">
                                                <ListTreeIcon />
                                                <span>By Package/Group</span>
                                            </DropdownMenuRadioItem>
                                        </DropdownMenuRadioGroup>
                                    </DropdownMenuGroup>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Show</DropdownMenuLabel>
                                        <DropdownMenuCheckboxItem
                                            checked={showSkillDescription}
                                            onCheckedChange={setShowSkillDescription}
                                        >
                                            <span>Skill Description</span>
                                        </DropdownMenuCheckboxItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Saratoga.Actions>
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
                        <Show
                            when={isAssignedAssessor}
                            fallback={
                                <Alert variant="warning">
                                    <AlertTitle>Not an assigned assessor</AlertTitle>
                                    <AlertDescription>
                                        You are not an assigned assessor for this session, so you
                                        cannot record skill checks here.
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
                                                value={selected?.personId ?? undefined}
                                                onValueChange={(value) => {
                                                    handleSwitchPerson(value as PersonId);
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a person" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {assignedPersonnel.map((person) => (
                                                        <SelectItem
                                                            key={person.id}
                                                            value={person.id}
                                                        >
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
                                                    person.id === selected?.personId
                                                        ? "outline"
                                                        : "default"
                                                }
                                            >
                                                <a
                                                    onClick={() => {
                                                        handleSwitchPerson(person.id);
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
                                <div className="w-full flex flex-col gap-2">
                                    {match(selected)
                                        .with(null, () => (
                                            <Empty>
                                                <EmptyMedia>
                                                    <ArrowLeftIcon className="hidden lg:block size-12 text-muted-foreground" />
                                                    <ArrowUpIcon className="block lg:hidden size-12 text-muted-foreground" />
                                                </EmptyMedia>
                                                <EmptyDescription>
                                                    Select a person to assess their skills.
                                                </EmptyDescription>
                                            </Empty>
                                        ))
                                        .with({ status: "Loading" }, () => (
                                            <div className="flex justify-center items-center my-8">
                                                <RainbowSpinner />
                                            </div>
                                        ))
                                        .with({ status: "Selected" }, ({ personId }) => {
                                            const renderRow = (
                                                skill: (typeof sessionSkills)[number],
                                            ) => (
                                                <SkillTrack_AssessmentRow
                                                    key={skill.id}
                                                    title={skill.name}
                                                    description={
                                                        showSkillDescription
                                                            ? assessableSkillById.get(skill.id)
                                                                  ?.description || undefined
                                                            : undefined
                                                    }
                                                    value={getCurrentValue(personId, skill.id)}
                                                    onValueChange={(newValue) =>
                                                        handleChange(skill.id, newValue)
                                                    }
                                                />
                                            );

                                            return match(skillOrder)
                                                .with("alphabetical", () => (
                                                    <>{sessionSkills.map(renderRow)}</>
                                                ))
                                                .with("by-package-group", () => (
                                                    <div className="space-y-4">
                                                        {packageSections.map(
                                                            ({ skillPackage, groups }) => (
                                                                <div
                                                                    key={skillPackage.id}
                                                                    className="space-y-4"
                                                                >
                                                                    <div className="font-semibold border-b pb-1">
                                                                        {skillPackage.name}
                                                                    </div>
                                                                    {groups.map(
                                                                        ({
                                                                            skillGroup,
                                                                            skills,
                                                                        }) => (
                                                                            <div
                                                                                key={skillGroup.id}
                                                                            >
                                                                                <div className="text-sm font-medium text-muted-foreground">
                                                                                    {
                                                                                        skillGroup.name
                                                                                    }
                                                                                </div>
                                                                                {skills.map(
                                                                                    renderRow,
                                                                                )}
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                        {ungroupedSkills.length > 0 && (
                                                            <div className="space-y-4">
                                                                <div className="font-semibold border-b pb-1">
                                                                    Other
                                                                </div>
                                                                {ungroupedSkills.map(renderRow)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                                .exhaustive();
                                        })
                                        .exhaustive()}
                                </div>
                            </div>
                        </Show>
                    </Show>
                    {/* </CardContent>
                    </Card> */}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
