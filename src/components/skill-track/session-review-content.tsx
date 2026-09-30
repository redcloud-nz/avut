/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon, LockOpenIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { SkillsModule_ApproveSession_Dialog } from "@/components/skill-track/approve-session";
import { SkillsModule_ReopenSession_Dialog } from "@/components/skill-track/reopen-session";
import { SkillTrack_SessionReview_Conflicts } from "@/components/skill-track/session-review-conflicts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

    // What Approve would submit: the selected checks, and how many of the session's checks that
    // leaves out.
    const includedCheckIds = skillChecks
        .filter((check) => selected.has(check.id))
        .map((check) => check.id);
    const excludedCount = skillChecks.length - includedCheckIds.length;

    // Why Approve is disabled, if it is. `null` means it can open the confirm dialog.
    const approveBlockedReason =
        skillChecks.length === 0
            ? "No skill checks to approve"
            : unresolvedConflicts > 0
              ? `Resolve ${unresolvedConflicts} ${unresolvedConflicts === 1 ? "conflict" : "conflicts"} to approve`
              : null;

    // When this page last approved the session (the time it was submitted), set by the approve
    // dialog's success. Right after it, `getSession` flips to `Include` before `listSkillChecks`
    // has refetched the stamped statuses. Until checks newer than the approval arrive, show
    // `selected` (what was just approved) rather than the stale pre-approval statuses, which
    // would read as all unticked. Any other time, an approved session shows its stored statuses,
    // background refetches included.
    const [approvedAt, setApprovedAt] = useState<number | null>(null);
    // The page stays mounted across approve → reopen; forget the old approval once it's reopened.
    if (!isApproved && approvedAt !== null) setApprovedAt(null);
    const awaitingStampedChecks = approvedAt !== null && checksUpdatedAt < approvedAt;
    const showApproval = isApproved && !awaitingStampedChecks;

    // One `?action=` owner for both dialogs on this page: two literal parsers would each read the
    // other's value as `null`. Reopen opens only on an approved session; Approve only on one that
    // isn't, and only when it isn't blocked. Both need the approve permission.
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["reopen", "approve"] as const),
    );
    const canOpenReopen = canApprove && isApproved;
    const canOpenApprove = canApprove && !isApproved && approveBlockedReason === null;

    function openAction(next: "reopen" | "approve") {
        void setAction(next, { history: "push" });
    }
    function closeAction(only: "reopen" | "approve") {
        void setAction((current) => (current === only ? null : current), { history: "replace" });
    }

    // A pasted `?action=approve` on an approved session or a blocked draft (or `?action=reopen`
    // on a draft), or a session whose status changed while one was open: clear the param,
    // replacing the history entry. `open` is masked until it's gone.
    const staleAction =
        (action === "approve" && !canOpenApprove) || (action === "reopen" && !canOpenReopen)
            ? action
            : null;
    useEffect(() => {
        if (staleAction) closeAction(staleAction);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `closeAction` is rebuilt every render
    }, [staleAction]);

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
                        <Saratoga.Actions>
                            <Protect permissions={{ skillCheckSession: ["approve"] }}>
                                {isApproved ? (
                                    <Button variant="outline" onClick={() => openAction("reopen")}>
                                        <LockOpenIcon /> Reopen
                                    </Button>
                                ) : approveBlockedReason ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            {/* A disabled button gets no pointer events, so the
                                                wrapper takes the hover and focus instead. */}
                                            <span tabIndex={0}>
                                                <Button disabled>Approve</Button>
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>{approveBlockedReason}</TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <Button onClick={() => openAction("approve")}>Approve</Button>
                                )}
                                <SkillsModule_ReopenSession_Dialog
                                    session={session}
                                    open={canOpenReopen && action === "reopen"}
                                    onOpenChange={(open) =>
                                        open ? openAction("reopen") : closeAction("reopen")
                                    }
                                />
                                <SkillsModule_ApproveSession_Dialog
                                    session={session}
                                    includedCheckIds={includedCheckIds}
                                    includedCount={includedCheckIds.length}
                                    excludedCount={excludedCount}
                                    onApproved={setApprovedAt}
                                    open={canOpenApprove && action === "approve"}
                                    onOpenChange={(open) =>
                                        open ? openAction("approve") : closeAction("approve")
                                    }
                                />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Show when={isApproved}>
                        <Alert>
                            <AlertTitle>Approved</AlertTitle>
                            <AlertDescription>
                                <p>
                                    This session has been approved and is locked. To change the
                                    selection, reopen it with Reopen at the top of the page.
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
