/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Show } from "@/components/show";
import { SkillTrack_SessionReview_Conflicts } from "@/components/skill-track/session-review-conflicts";
import { useRefetchSessionOnConflict } from "@/components/skill-track/use-refetch-session-on-conflict";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { getSkillCheckResultLabel, SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { findConflicts, initialSelection, reconcileSelection } from "@/lib/skill-check-conflicts";
import { trpc } from "@/trpc/client";

export function SkillTrack_SessionReview_Content({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();

    const [
        { data: session },
        { data: assessees },
        { data: assessors },
        { data: sessionSkills },
        { data: skillChecks, dataUpdatedAt: checksUpdatedAt },
    ] = useSuspenseQueries({
        queries: [
            trpc.skillCheckSessions.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
            }),
            trpc.skillCheckSessions.listSessionAssessees.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "all",
            }),
            trpc.skillCheckSessions.listSessionAssessors.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "all",
            }),
            trpc.skillCheckSessions.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "all",
            }),
            trpc.skillChecks.listSkillChecks.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
            }),
        ],
    });

    const assesseeById = useMemo(() => new Map(assessees.map((p) => [p.id, p])), [assessees]);

    const skillById = useMemo(() => new Map(sessionSkills.map((s) => [s.id, s])), [sessionSkills]);

    const assessorById = useMemo(() => new Map(assessors.map((p) => [p.id, p])), [assessors]);

    // An approved session is locked until it's reopened: its checkboxes are read-only and show
    // the approval itself (`Include` checks), not `selected` (see `AssesseeChecks`).
    const isApproved = session.status === "Include";

    // Whoever can approve resolves conflicts; for anyone else the controls are read-only.
    const canApprove = useHasPermission({ skillCheckSession: ["approve"] });
    const controlsDisabled = isApproved || !canApprove;

    // The editable view's selection, shared by the Conflicts card (one pick per conflict group)
    // and the checks list (everything else). The rules for what starts selected, and how the
    // selection follows a refetch of the checks, live in `initialSelection`/`reconcileSelection`.
    // The page stays mounted across approve → reopen and across refetches, so each new
    // `skillChecks` is reconciled against the previous one rather than reset.
    const [selected, setSelected] = useState<Set<SkillCheckId>>(() =>
        initialSelection(skillChecks),
    );
    const [prevSkillChecks, setPrevSkillChecks] = useState(skillChecks);
    if (skillChecks !== prevSkillChecks) {
        setPrevSkillChecks(skillChecks);
        setSelected((prev) => reconcileSelection(prevSkillChecks, skillChecks, prev));
    }

    const conflicts = useMemo(() => findConflicts(skillChecks), [skillChecks]);
    const conflictCheckIds = useMemo(
        () => new Set(conflicts.flatMap((conflict) => conflict.checks.map((c) => c.id))),
        [conflicts],
    );
    const unresolvedConflicts = conflicts.filter(
        (conflict) => !conflict.checks.some((c) => selected.has(c.id)),
    ).length;

    const refetchSessionOnConflict = useRefetchSessionOnConflict(sessionId);
    const mutation = useMutation(
        trpc.skillCheckSessions.approveSession.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.approveSession },
            onError(error) {
                toast.error(`Failed to approve session: ${error.message}`);
                refetchSessionOnConflict(error);
            },
            onSuccess() {
                toast.success("Session approved.");
            },
        }),
    );

    // Right after this page's approval, `getSession` flips to `Include` before `listSkillChecks`
    // has refetched the stamped statuses. Until checks newer than the approval arrive, show
    // `selected` (what was just approved) rather than the stale pre-approval statuses, which
    // would read as all unticked. Any other time, an approved session shows its stored statuses,
    // background refetches included.
    const awaitingStampedChecks = mutation.isSuccess && checksUpdatedAt < mutation.submittedAt;
    const showApproval = isApproved && !awaitingStampedChecks;

    // The page stays mounted across approve → reopen, so a finished approval would otherwise
    // leave the button reading "Submitted" once the session is editable again.
    const { reset: resetMutation } = mutation;
    useEffect(() => {
        if (!isApproved) resetMutation();
    }, [isApproved, resetMutation]);

    function toggleCheck(id: SkillCheckId) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleGroup(checkIds: SkillCheckId[]) {
        const allSelected = checkIds.every((id) => selected.has(id));
        setSelected((prev) => {
            const next = new Set(prev);
            for (const id of checkIds) {
                if (allSelected) next.delete(id);
                else next.add(id);
            }
            return next;
        });
    }

    function pick(groupIds: SkillCheckId[], checkId: SkillCheckId) {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const id of groupIds) next.delete(id);
            next.add(checkId);
            return next;
        });
    }

    function handleApprove() {
        mutation.mutate({
            organizationId: organization.id,
            sessionId: sessionId,
            includedCheckIds: [...selected],
        });
    }

    return (
        <>
            <Std.Navbar
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
                    "Review",
                ]}
                actions={<HelpButton slug="skill-track/sessions" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Review</Saratoga.Title>
                    </Saratoga.Header>
                    <Show when={isApproved}>
                        <Alert>
                            <AlertTitle>Approved</AlertTitle>
                            <AlertDescription>
                                <p>
                                    This session has been approved. To change the selection, reopen
                                    it from the{" "}
                                    <Link
                                        href={route(
                                            "/orgs/[slug]/skill-track/sessions/[session_id]",
                                            {
                                                slug: organization.slug,
                                                session_id: sessionId,
                                            },
                                        )}
                                    >
                                        session page
                                    </Link>
                                    .
                                </p>
                            </AlertDescription>
                        </Alert>
                    </Show>

                    <Show
                        when={skillChecks.length > 0}
                        fallback={
                            <Empty>
                                <EmptyMedia>
                                    <ClipboardCheckIcon className="size-12 text-muted-foreground" />
                                </EmptyMedia>
                                <EmptyDescription>
                                    No skill checks have been recorded for this session yet.
                                </EmptyDescription>
                            </Empty>
                        }
                    >
                        <Show when={conflicts.length > 0}>
                            <SkillTrack_SessionReview_Conflicts
                                conflicts={conflicts}
                                selected={selected}
                                pick={pick}
                                assesseeById={assesseeById}
                                skillById={skillById}
                                assessorById={assessorById}
                                disabled={controlsDisabled}
                                showApproval={showApproval}
                            />
                        </Show>
                        <Card>
                            <CardHeader>
                                <CardTitle>Review</CardTitle>
                                <CardDescription>
                                    {isApproved
                                        ? "The selected skill checks were included in the session approval. Only they count towards the session results."
                                        : "Select the skill checks you want to include in the session approval. Only the selected checks will be included in the session results."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeadCell></TableHeadCell>
                                            <TableHeadCell>Assessee</TableHeadCell>
                                            <TableHeadCell>Skill</TableHeadCell>
                                            <TableHeadCell>Result</TableHeadCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {assessees.map((assessee) => (
                                            <AssesseeChecks
                                                key={assessee.id}
                                                assessee={assessee}
                                                assesseeChecks={skillChecks.filter(
                                                    (check) => check.assesseeId === assessee.id,
                                                )}
                                                skillById={skillById}
                                                assessorById={assessorById}
                                                selected={selected}
                                                conflictCheckIds={conflictCheckIds}
                                                disabled={controlsDisabled}
                                                showApproval={showApproval}
                                                toggleCheck={toggleCheck}
                                                toggleGroup={toggleGroup}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <Show when={!isApproved}>
                                <CardFooter className="justify-end">
                                    <MutationButton
                                        status={mutation.status}
                                        disabled={!canApprove || unresolvedConflicts > 0}
                                        onClick={handleApprove}
                                        text={{
                                            idle: "Approve",
                                            pending: "Submitting...",
                                            success: "Submitted",
                                        }}
                                    />
                                </CardFooter>
                            </Show>
                        </Card>
                    </Show>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

interface AssesseeChecksProps {
    assessee: PersonRef;
    assesseeChecks: SkillCheck[];
    skillById: Map<SkillId, SkillRef>;
    assessorById: Map<PersonId, PersonRef>;
    selected: Set<SkillCheckId>;
    /**
     * The checks in a conflict group. Their pick is made in the Conflicts card, so here their
     * checkboxes only show it, and the assessee's select-all leaves them alone.
     */
    conflictCheckIds: ReadonlySet<SkillCheckId>;
    /** True while the session is approved, or the viewer can't approve: the checkboxes are read-only. */
    disabled: boolean;
    /**
     * Show the approval itself (`Include` checks) rather than the local selection, so a refetch is
     * reflected and a check that raced the approval in as `Draft` isn't shown ticked. False while
     * the checks are still refetching after an approval, when `selected` is the better answer.
     */
    showApproval: boolean;
    toggleCheck(id: SkillCheckId): void;
    toggleGroup(ids: SkillCheckId[]): void;
}

function AssesseeChecks({
    assessee,
    assesseeChecks,
    skillById,
    selected,
    conflictCheckIds,
    disabled,
    showApproval,
    toggleCheck,
    toggleGroup,
}: AssesseeChecksProps) {
    const organization = useOrganization();
    const isChecked = (check: SkillCheck) =>
        showApproval ? check.status === "Include" : selected.has(check.id);
    const hasChecks = assesseeChecks.length > 0;

    // Select-all covers only the checks outside conflict groups. If every check is in one, there's
    // nothing for it to toggle, so it isn't shown.
    const toggleable = assesseeChecks.filter((check) => !conflictCheckIds.has(check.id));
    const selectedCount = toggleable.filter(isChecked).length;

    return (
        <>
            <TableRow>
                <TableCell>
                    {toggleable.length > 0 && (
                        <Checkbox
                            id={`select-all-${assessee.id}`}
                            checked={
                                selectedCount === toggleable.length
                                    ? true
                                    : selectedCount === 0
                                      ? false
                                      : "indeterminate"
                            }
                            disabled={disabled}
                            onCheckedChange={() => toggleGroup(toggleable.map((check) => check.id))}
                        />
                    )}
                </TableCell>
                <TableCell className="font-medium" colSpan={2}>
                    {assessee.name}
                </TableCell>
                {!hasChecks && (
                    <TableCell className="text-muted-foreground">
                        No skill checks recorded
                    </TableCell>
                )}
            </TableRow>
            {assesseeChecks.map((check) => {
                const skill = skillById.get(check.skillId);
                return (
                    <TableRow key={check.id}>
                        <TableCell>
                            <Checkbox
                                id={`check-${check.id}`}
                                checked={isChecked(check)}
                                disabled={disabled || conflictCheckIds.has(check.id)}
                                onCheckedChange={() => toggleCheck(check.id)}
                            />
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell>{skill?.name ?? check.skillId}</TableCell>
                        <TableCell>
                            {getSkillCheckResultLabel(organization.settings, check.result)}
                        </TableCell>
                    </TableRow>
                );
            })}
        </>
    );
}
