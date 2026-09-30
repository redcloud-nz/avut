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
import { SkillTrack_SessionReview_Coverage } from "@/components/skill-track/session-review-coverage";
import { SkillTrack_SessionReview_Summary } from "@/components/skill-track/session-review-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { findConflicts, initialSelection, reconcileSelection } from "@/lib/skill-check-conflicts";
import { coverageBy } from "@/lib/skill-check-coverage";
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
        { data: assignedAssessees },
        { data: assignedSkills },
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
            trpc.skillCheckSessions.listSessionAssessees.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "assigned",
            }),
            trpc.skillCheckSessions.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "assigned",
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
    // What the approval itself included, for the approved view.
    const storedIncludedCount = useMemo(
        () => skillChecks.filter((check) => check.status === "Include").length,
        [skillChecks],
    );

    // Each person's and each skill's checks and coverage. The entries come from the `all` lists,
    // so every check is reachable from one; coverage counts only the `assigned` other side.
    const peopleCoverage = useMemo(
        () =>
            coverageBy(
                "assessee",
                assessees.map((p) => p.id),
                assignedSkills.map((s) => s.id),
                skillChecks,
            ),
        [assessees, assignedSkills, skillChecks],
    );
    const skillsCoverage = useMemo(
        () =>
            coverageBy(
                "skill",
                sessionSkills.map((s) => s.id),
                assignedAssessees.map((p) => p.id),
                skillChecks,
            ),
        [sessionSkills, assignedAssessees, skillChecks],
    );
    // The share of assigned assessee and skill pairs with at least one live check: the assigned
    // people's covered skills over every assigned pair. The same figure as the Personnel and
    // Skills cards' average coverage, give or take anyone no longer assigned.
    const coveragePercent = useMemo(() => {
        const pairs = assignedAssessees.length * assignedSkills.length;
        if (pairs === 0) return 0;
        const assigned = new Set(assignedAssessees.map((p) => p.id));
        const covered = peopleCoverage
            .filter((entry) => assigned.has(entry.id))
            .reduce((sum, entry) => sum + entry.covered, 0);
        return Math.round((covered / pairs) * 100);
    }, [assignedAssessees, assignedSkills, peopleCoverage]);

    // Why Approve is disabled, if it is. `null` means it can open the confirm dialog.
    const approveBlockedReason =
        skillChecks.length === 0
            ? "No skill checks to approve"
            : unresolvedConflicts > 0
              ? `Resolve ${unresolvedConflicts} ${unresolvedConflicts === 1 ? "conflict" : "conflicts"} to approve`
              : null;

    // Showing this page's own approval before its stamped checks arrive. The approve mutation's
    // cache effects run before the dialog hears it succeeded: they write `getSession` as `Include`
    // and then await the `listSkillChecks` refetch. So from submit until checks fetched since the
    // submit (`approvedAt`) are in, show `selected` (what was just approved) rather than the
    // pre-approval statuses, which would read as all unticked. The stamped checks switch straight
    // to stored statuses, without waiting for the mutation to settle: they reset the conflict
    // picks in `selected`, so holding `selected` until then would flash the radios empty. (A
    // background fetch that lands between submit and commit could end the wait early; the
    // effector's invalidate cancels in-flight fetches, so that window is negligible.) Any other
    // time, an approved session shows its stored statuses, background refetches included. A
    // failed approval clears the stamp: on a conflict the refetch brings in someone else's
    // approval, which should show as stored. `approving` only keeps the dialog open.
    const [approving, setApproving] = useState(false);
    const [approvedAt, setApprovedAt] = useState<number | null>(null);
    function handleApproving(submittedAt: number) {
        setApproving(true);
        setApprovedAt(submittedAt);
    }
    function handleApproveSettled(ok: boolean) {
        setApproving(false);
        if (!ok) setApprovedAt(null);
    }
    // The page stays mounted across approve → reopen; forget the old approval once the session
    // goes from approved to unapproved (not merely while it's unapproved, which would wipe the
    // stamp of an approval still in flight).
    const [prevIsApproved, setPrevIsApproved] = useState(isApproved);
    if (isApproved !== prevIsApproved) {
        setPrevIsApproved(isApproved);
        if (!isApproved) setApprovedAt(null);
    }
    const awaitingStampedChecks = approvedAt !== null && checksUpdatedAt < approvedAt;
    const showApproval = isApproved && !awaitingStampedChecks;

    // One `?action=` owner for both dialogs on this page: two literal parsers would each read the
    // other's value as `null`. Reopen opens only on an approved session; Approve only on one that
    // isn't, and only when it isn't blocked. Both need the approve permission. While the dialog's
    // own approval is pending, the session turning approved (or the stamped checks reshuffling the
    // conflict picks) isn't a reason to close it; it closes itself on success.
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["reopen", "approve"] as const),
    );
    const canOpenReopen = canApprove && isApproved;
    const canOpenApprove =
        canApprove && (approving || (!isApproved && approveBlockedReason === null));

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
                                    onApproving={handleApproving}
                                    onApproveSettled={handleApproveSettled}
                                    open={canOpenApprove && action === "approve"}
                                    onOpenChange={(open) =>
                                        open ? openAction("approve") : closeAction("approve")
                                    }
                                />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    {/* The same gap between cards as the session page's columns. */}
                    <div className="flex flex-col gap-4">
                        <Show when={isApproved}>
                            <Alert>
                                <AlertTitle>Approved</AlertTitle>
                                <AlertDescription>
                                    <p>
                                        This session has been approved and is locked.{" "}
                                        <Protect permissions={{ skillCheckSession: ["approve"] }}>
                                            To change the selection, reopen it with Reopen at the
                                            top of the page.
                                        </Protect>
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
                            <SkillTrack_SessionReview_Summary
                                includedCount={
                                    showApproval ? storedIncludedCount : includedCheckIds.length
                                }
                                excludedCount={
                                    showApproval
                                        ? skillChecks.length - storedIncludedCount
                                        : excludedCount
                                }
                                conflictCount={conflicts.length}
                                unresolvedConflicts={unresolvedConflicts}
                                coveragePercent={coveragePercent}
                                showApproval={showApproval}
                            />
                            <Show when={conflicts.length > 0}>
                                <SkillTrack_SessionReview_Conflicts
                                    id="conflicts"
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
                            <SkillTrack_SessionReview_Coverage
                                id="coverage"
                                people={peopleCoverage}
                                skills={skillsCoverage}
                                assesseeById={assesseeById}
                                skillById={skillById}
                                assessorById={assessorById}
                                selected={selected}
                                conflictCheckIds={conflictCheckIds}
                                disabled={controlsDisabled}
                                showApproval={showApproval}
                                toggleCheck={toggleCheck}
                            />
                        </Show>
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
