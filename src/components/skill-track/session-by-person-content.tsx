/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ArrowLeftIcon, ArrowUpIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import * as R from "remeda";
import { match } from "ts-pattern";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Show } from "@/components/show";
import { SkillTrack_CheckRow } from "@/components/skill-track/check-row";
import { SkillTrack_RecordCheckDialog } from "@/components/skill-track/record-check-dialog";
import {
    SessionSkillOrder,
    SkillTrack_RecordingOptionsSheet,
} from "@/components/skill-track/recording-options-sheet";
import { SkillTrack_SessionApprovedEmpty } from "@/components/skill-track/session-approved-empty";
import {
    sessionCheckKey,
    usePendingChecks,
    useSessionCheckRecorder,
} from "@/components/skill-track/use-session-check-recorder";
import {
    useOtherAssessorChecks,
    useSessionChecksSync,
} from "@/components/skill-track/use-session-checks-sync";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { RainbowSpinner } from "@/components/ui/loading";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import {
    getEnabledSkillCheckResultOptions,
    getSkillCheckResultLabel,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/** The (assessee, skill) check the record dialog is open on. */
type CheckDialogTarget = { assesseeId: PersonId; skillId: SkillId };

export function SkillTrack_SessionByPerson_Content({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();

    const resultOptions = getEnabledSkillCheckResultOptions(organization.settings);

    const skillChecksQueryOptions = trpc.skillChecks.listSkillChecks.queryOptions({
        organizationId: organization.id,
        sessionId: sessionId,
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
            trpc.skillCheckSessions.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
            }),
            trpc.skillCheckSessions.listSessionAssessees.queryOptions({
                sessionId: sessionId,
                organizationId: organization.id,
                scope: "assigned",
            }),
            skillChecksQueryOptions,
            trpc.skillCheckSessions.listSessionSkills.queryOptions({
                sessionId: sessionId,
                organizationId: organization.id,
                scope: "assigned",
            }),
            trpc.personnel.getPersonSelf.queryOptions({
                organizationId: organization.id,
            }),
            trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const { record, remove } = useSessionCheckRecorder({ sessionId });
    const pendingChecks = usePendingChecks(sessionId);

    const isAssignedAssessor =
        !!personSelf && session.assessors.some((assessor) => assessor.id === personSelf.id);
    // Recording also needs `skillCheck: ["create"]` (see `setSessionSkillCheck` and
    // `deleteSessionSkillCheck`), which a caller holding only session update lacks.
    const canRecordChecks = useHasPermission({ skillCheck: ["create"] });
    // Polls the other assessors' checks (and the caller's own from other devices) while the caller
    // could record, approved or not. When the session is approved or reopened elsewhere, the page
    // locks, or unlocks, on the next poll for a recording assessor; anyone else sees it on focus
    // or reload.
    const sessionChecks = useSessionChecksSync({
        sessionId,
        selfPersonId: personSelf?.id,
        enabled: !!personSelf && isAssignedAssessor && canRecordChecks,
    });
    // The "Also checked by" markers, keyed by (assessee, skill).
    const otherChecksByKey = useOtherAssessorChecks(sessionChecks, personSelf?.id);
    // An approved session is locked until it's reopened (`assertSessionUnlocked`): the page shows
    // only a message in place of its content, and the record dialog is closed.
    const isApproved = session.status === "Include";

    type Selected = { personId: PersonId; status: "Loading" | "Selected" } | null;
    const [selected, setSelected] = useState<Selected>(null);
    // A config change can take the selected person off the session. Clear the selection then
    // (during render, so the stale person is never shown), so re-adding them later doesn't
    // silently re-select them.
    if (selected && !assignedPersonnel.some((person) => person.id === selected.personId)) {
        setSelected(null);
    }

    async function handleSwitchPerson(personId: PersonId) {
        setSelected({ personId, status: "Loading" });
        await new Promise((resolve) => setTimeout(resolve, 200));

        setSelected({ personId, status: "Selected" });
    }

    // The check the dialog targets. Closing only sets `dialogOpen` false and leaves `target` in
    // place, so the title and grid don't blank out during the exit animation. The next open
    // replaces it.
    const [target, setTarget] = useState<CheckDialogTarget | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    // Like `selected`, clear a target whose person or skill has left the session.
    if (
        target &&
        (!assignedPersonnel.some((person) => person.id === target.assesseeId) ||
            !sessionSkills.some((skill) => skill.id === target.skillId))
    ) {
        setTarget(null);
        setDialogOpen(false);
    }

    // Close the dialog when the session is approved under it (during render, like the resets
    // above), so a later reopen doesn't pop it back up.
    if (isApproved && dialogOpen) {
        setDialogOpen(false);
    }

    function openDialog(assesseeId: PersonId, skillId: SkillId) {
        setTarget({ assesseeId, skillId });
        setDialogOpen(true);
    }

    function getSavedCheck(assesseeId: PersonId, skillId: SkillId) {
        const savedCheck = skillChecks.find(
            (check) => check.skillId == skillId && check.assesseeId == assesseeId,
        );
        return savedCheck ? { result: savedCheck.result, notes: savedCheck.notes } : null;
    }

    const resultLabel = (value: SkillCheckResultValue) =>
        getSkillCheckResultLabel(organization.settings, value);

    const [skillOrder, setSkillOrder] = useState<SessionSkillOrder>("by-package-group");

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

    const navbar = (
        <Std.Navbar>
            <Std.Breadcrumbs
                breadcrumbs={[
                    {
                        label: "Skill Track",
                        href: route("/orgs/[slug]/skill-track", { slug: organization.slug }),
                    },
                    {
                        label: "Sessions",
                        href: route("/orgs/[slug]/skill-track/sessions", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: session.name || session.id,
                        href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                            slug: organization.slug,
                            session_id: sessionId,
                        }),
                    },
                    "By Person",
                ]}
            />
            <div className="flex items-center justify-end gap-1 grow">
                <HelpButton slug="skill-track/sessions" />
            </div>
        </Std.Navbar>
    );

    if (isApproved) {
        return (
            <>
                {navbar}
                <Std.ScrollContainer className="flex">
                    <SkillTrack_SessionApprovedEmpty sessionId={sessionId} />
                </Std.ScrollContainer>
            </>
        );
    }

    return (
        <>
            {navbar}
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Assess by Person</Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillTrack_RecordingOptionsSheet
                                sessionId={sessionId}
                                mode="by-person"
                                view={{ skillOrder, onSkillOrderChange: setSkillOrder }}
                            />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Show
                        when={!!personSelf}
                        fallback={
                            <Alert variant="warning">
                                <AlertTitle>No linked person record</AlertTitle>
                                <AlertDescription>
                                    Your account is not linked to a person record in this
                                    organisation. Contact an administrator to link your account
                                    before recording skill checks.
                                </AlertDescription>
                            </Alert>
                        }
                    >
                        <Show
                            when={isAssignedAssessor && canRecordChecks}
                            fallback={
                                isAssignedAssessor ? (
                                    <Alert variant="warning">
                                        <AlertTitle>Cannot record skill checks</AlertTitle>
                                        <AlertDescription>
                                            You are an assessor on this session, but your role does
                                            not allow recording skill checks.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Alert variant="warning">
                                        <AlertTitle>Not an assigned assessor</AlertTitle>
                                        <AlertDescription>
                                            You are not an assigned assessor for this session, so
                                            you cannot record skill checks here.
                                        </AlertDescription>
                                    </Alert>
                                )
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
                                <div className="w-full flex flex-col gap-5">
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
                                                <SkillTrack_CheckRow
                                                    key={skill.id}
                                                    title={skill.name}
                                                    check={getSavedCheck(personId, skill.id)}
                                                    pending={pendingChecks.get(
                                                        sessionCheckKey(personId, skill.id),
                                                    )}
                                                    resultOptions={resultOptions}
                                                    resultLabel={resultLabel}
                                                    otherChecks={otherChecksByKey.get(
                                                        sessionCheckKey(personId, skill.id),
                                                    )}
                                                    onRecord={(value) =>
                                                        record({
                                                            assesseeId: personId,
                                                            skillId: skill.id,
                                                            ...value,
                                                        })
                                                    }
                                                    onRemove={() =>
                                                        remove({
                                                            assesseeId: personId,
                                                            skillId: skill.id,
                                                        })
                                                    }
                                                    onOpenDialog={() =>
                                                        openDialog(personId, skill.id)
                                                    }
                                                />
                                            );

                                            return match(skillOrder)
                                                .with("alphabetical", () => (
                                                    <>{sessionSkills.map(renderRow)}</>
                                                ))
                                                .with("by-package-group", () => (
                                                    <div className="space-y-6">
                                                        {packageSections.map(
                                                            ({ skillPackage, groups }) => (
                                                                <div
                                                                    key={skillPackage.id}
                                                                    className="space-y-6"
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
                                                                                <div className="text-sm font-medium text-muted-foreground mb-2">
                                                                                    {
                                                                                        skillGroup.name
                                                                                    }
                                                                                </div>
                                                                                <div className="flex flex-col gap-5">
                                                                                    {skills.map(
                                                                                        renderRow,
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                        {ungroupedSkills.length > 0 && (
                                                            <div className="space-y-6">
                                                                <div className="font-semibold border-b pb-1">
                                                                    Other
                                                                </div>
                                                                <div className="flex flex-col gap-5">
                                                                    {ungroupedSkills.map(renderRow)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                                .exhaustive();
                                        })
                                        .exhaustive()}
                                    {target && (
                                        <SkillTrack_RecordCheckDialog
                                            open={dialogOpen}
                                            onOpenChange={setDialogOpen}
                                            targetKey={sessionCheckKey(
                                                target.assesseeId,
                                                target.skillId,
                                            )}
                                            skillName={
                                                sessionSkills.find(
                                                    (skill) => skill.id === target.skillId,
                                                )?.name ?? ""
                                            }
                                            skillDescription={
                                                assessableSkillById.get(target.skillId)
                                                    ?.description || undefined
                                            }
                                            personName={
                                                assignedPersonnel.find(
                                                    (person) => person.id === target.assesseeId,
                                                )?.name ?? ""
                                            }
                                            current={getSavedCheck(
                                                target.assesseeId,
                                                target.skillId,
                                            )}
                                            resultOptions={resultOptions}
                                            resultLabel={resultLabel}
                                            onRecord={(value) =>
                                                record({
                                                    assesseeId: target.assesseeId,
                                                    skillId: target.skillId,
                                                    ...value,
                                                })
                                            }
                                            onDelete={() =>
                                                remove({
                                                    assesseeId: target.assesseeId,
                                                    skillId: target.skillId,
                                                })
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        </Show>
                    </Show>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
