/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon, LockOpenIcon } from "lucide-react";
import {
    parseAsBoolean,
    parseAsString,
    parseAsStringLiteral,
    useQueryState,
    useQueryStates,
} from "nuqs";
import { useEffect, useMemo } from "react";

import { useIsMutating, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { SkillsModule_ApproveSession_Dialog } from "@/components/skill-track/approve-session";
import { SkillsModule_ReopenSession_Dialog } from "@/components/skill-track/reopen-session";
import { SkillsModule_ResolveConflict_Dialog } from "@/components/skill-track/resolve-conflict";
import {
    ReviewChecksSubject,
    SkillsModule_ReviewChecks_Dialog,
} from "@/components/skill-track/review-checks-dialog";
import { SkillTrack_SessionReview_Conflicts } from "@/components/skill-track/session-review-conflicts";
import {
    coverageSummary,
    SkillTrack_SessionReview_Coverage,
} from "@/components/skill-track/session-review-coverage";
import { SkillTrack_SessionReview_Summary } from "@/components/skill-track/session-review-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheck } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import {
    findConflicts,
    isCheckIncluded,
    isConflictResolved,
    pairKey,
    SkillCheckConflict,
} from "@/lib/skill-check-conflicts";
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
        { data: skillChecks },
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

    // An approved session is locked until it's reopened: its controls are read-only.
    const isApproved = session.status === "Include";

    // Whoever can approve resolves conflicts and excludes checks; for anyone else the controls
    // are read-only.
    const canApprove = useHasPermission({ skillCheckSession: ["approve"] });

    // Each decision is saved as it's made, by the Resolve and check dialogs' Save: a check is
    // included unless its status is `Exclude` (`isCheckIncluded`), and Approve approves that saved
    // state. The check dialogs are read-only on an approved session or for a viewer who can't
    // approve.
    const reviewReadOnly = isApproved || !canApprove;
    // A dialog's save still in flight (it can be closed before the save lands).
    const savingExclusions =
        useIsMutating({
            mutationKey: trpc.skillCheckSessions.updateCheckExclusions.mutationKey(),
        }) > 0;

    const conflicts = useMemo(() => findConflicts(skillChecks), [skillChecks]);
    const conflictCheckIds = useMemo(
        () => new Set(conflicts.flatMap((conflict) => conflict.checks.map((c) => c.id))),
        [conflicts],
    );
    const unresolvedConflicts = conflicts.filter(
        (conflict) => !isConflictResolved(conflict),
    ).length;

    // What Approve confirms: the saved included checks, and how many of the session's checks that
    // leaves out.
    const includedCheckIds = skillChecks.filter(isCheckIncluded).map((check) => check.id);
    const excludedCount = skillChecks.length - includedCheckIds.length;
    // Distinct assessee and skill pairs with a check, for the summary strip.
    const uniqueCheckCount = useMemo(
        () => new Set(skillChecks.map((check) => pairKey(check.assesseeId, check.skillId))).size,
        [skillChecks],
    );

    // Include options from the header menu: unticking one drops the people (or skills) with no
    // checks from the lists and from every figure (card counts, averages, the Coverage tile), for
    // sessions that were never meant to cover everyone assigned. In the URL so they survive a
    // reload; `replace` keeps them out of the history.
    const [includeUnassessedPeople, setIncludeUnassessedPeople] = useQueryState(
        "unassessedPersonnel",
        parseAsBoolean.withDefault(true).withOptions({ history: "replace", clearOnDefault: true }),
    );
    const [includeUnassessedSkills, setIncludeUnassessedSkills] = useQueryState(
        "unassessedSkills",
        parseAsBoolean.withDefault(true).withOptions({ history: "replace", clearOnDefault: true }),
    );
    const assessedPeople = useMemo(
        () => new Set(skillChecks.map((check) => check.assesseeId)),
        [skillChecks],
    );
    const assessedSkills = useMemo(
        () => new Set(skillChecks.map((check) => check.skillId)),
        [skillChecks],
    );
    // The people and skills the page counts: the `all` lists for the cards, so every check can be
    // reached from one, and the `assigned` lists for coverage, each less the unassessed when
    // they're left out.
    const [listedPeople, countedPeople] = useMemo(
        () =>
            includeUnassessedPeople
                ? [assessees, assignedAssessees]
                : [
                      assessees.filter((p) => assessedPeople.has(p.id)),
                      assignedAssessees.filter((p) => assessedPeople.has(p.id)),
                  ],
        [includeUnassessedPeople, assessees, assignedAssessees, assessedPeople],
    );
    const [listedSkills, countedSkills] = useMemo(
        () =>
            includeUnassessedSkills
                ? [sessionSkills, assignedSkills]
                : [
                      sessionSkills.filter((s) => assessedSkills.has(s.id)),
                      assignedSkills.filter((s) => assessedSkills.has(s.id)),
                  ],
        [includeUnassessedSkills, sessionSkills, assignedSkills, assessedSkills],
    );

    // Each person's and each skill's checks and coverage, over the other side's counted list.
    const peopleCoverage = useMemo(
        () =>
            coverageBy(
                "assessee",
                listedPeople.map((p) => p.id),
                countedSkills.map((s) => s.id),
                skillChecks,
            ),
        [listedPeople, countedSkills, skillChecks],
    );
    const skillsCoverage = useMemo(
        () =>
            coverageBy(
                "skill",
                listedSkills.map((s) => s.id),
                countedPeople.map((p) => p.id),
                skillChecks,
            ),
        [listedSkills, countedPeople, skillChecks],
    );
    // The share of counted assessee and skill pairs with at least one live check: the counted
    // people's covered skills over every counted pair. The same figure as the Personnel and
    // Skills cards' average coverage, give or take anyone no longer assigned.
    const coveragePercent = useMemo(() => {
        const pairs = countedPeople.length * countedSkills.length;
        if (pairs === 0) return 0;
        const counted = new Set(countedPeople.map((p) => p.id));
        const covered = peopleCoverage
            .filter((entry) => counted.has(entry.id))
            .reduce((sum, entry) => sum + entry.covered, 0);
        return Math.round((covered / pairs) * 100);
    }, [countedPeople, countedSkills, peopleCoverage]);

    // Why Approve is disabled, if it is. `null` means it can open the confirm dialog.
    // While a decision is saving, the saved state (and so what Approve would confirm) is about to
    // change, so wait for it.
    const approveBlockedReason = savingExclusions
        ? "Saving changes"
        : skillChecks.length === 0
          ? "No skill checks to approve"
          : unresolvedConflicts > 0
            ? `Resolve ${unresolvedConflicts} ${unresolvedConflicts === 1 ? "conflict" : "conflicts"} to approve`
            : null;

    // One `?action=` owner for every dialog on this page: two literal parsers would each read the
    // other's value as `null`. Reopen opens only on an approved session; Approve only on one that
    // isn't, and only when it isn't blocked; Resolve only on one that isn't, for a conflict that
    // exists (`&personId=…&skillId=…` name it). All need the approve permission. A successful
    // approval turns the session approved, which closes Approve here as a stale action. The check
    // dialogs (`review-person&personId=…`, `review-skill&skillId=…`) open for anyone, for a person
    // or skill with checks, and are read-only where the controls are.
    // One `useQueryStates` for every dialog's params, so a close can check all of them in one updater.
    const [{ action, personId, skillId }, setActionParams] = useQueryStates({
        action: parseAsStringLiteral([
            "reopen",
            "approve",
            "resolve",
            "review-person",
            "review-skill",
        ] as const),
        personId: parseAsString,
        skillId: parseAsString,
    });
    const canOpenReopen = canApprove && isApproved;
    const canOpenApprove = canApprove && !isApproved && approveBlockedReason === null;
    const resolvingConflict =
        conflicts.find(
            (conflict) => conflict.assesseeId === personId && conflict.skillId === skillId,
        ) ?? null;
    const canOpenResolve = canApprove && !isApproved && resolvingConflict !== null;
    // The person (or skill) whose checks the check dialog shows: one listed with checks.
    const reviewingPerson =
        action === "review-person"
            ? (peopleCoverage.find((entry) => entry.id === personId && entry.checks.length > 0) ??
              null)
            : null;
    const reviewingSkill =
        action === "review-skill"
            ? (skillsCoverage.find((entry) => entry.id === skillId && entry.checks.length > 0) ??
              null)
            : null;

    function openAction(next: "reopen" | "approve") {
        void setActionParams({ action: next }, { history: "push" });
    }
    function openResolve(conflict: SkillCheckConflict<SkillCheck>) {
        void setActionParams(
            { action: "resolve", personId: conflict.assesseeId, skillId: conflict.skillId },
            { history: "push" },
        );
    }
    function openReview(subject: ReviewChecksSubject) {
        void setActionParams(
            subject.kind === "person"
                ? { action: "review-person", personId: subject.id, skillId: null }
                : { action: "review-skill", personId: null, skillId: subject.id },
            { history: "push" },
        );
    }
    type Action = NonNullable<typeof action>;
    // Closing a dialog that uses `personId`/`skillId` clears both, so a hand-edited URL leaves
    // no stray id behind.
    function closeParams(only: Action) {
        return only === "reopen" || only === "approve"
            ? { action: null }
            : { action: null, personId: null, skillId: null };
    }
    // Clears `action` only while it's still `only`, and the `personId`/`skillId` it owns only
    // with it: other dialogs use them too.
    function closeAction(only: Action) {
        void setActionParams((current) => (current.action !== only ? {} : closeParams(only)), {
            history: "replace",
        });
    }
    // After a save: close the check dialog only if the URL still names the subject saved, so a
    // save that lands late doesn't close another person's (or another dialog) opened since.
    function closeReviewedChecks(subject: ReviewChecksSubject) {
        const only = subject.kind === "person" ? "review-person" : "review-skill";
        void setActionParams(
            (current) =>
                current.action === only &&
                (subject.kind === "person" ? current.personId : current.skillId) === subject.id
                    ? closeParams(only)
                    : {},
            { history: "replace" },
        );
    }
    // After a save: close the Resolve dialog only if the URL still names the conflict saved, so
    // a save that lands late doesn't close another conflict (or another dialog) opened since.
    function closeResolvedConflict(conflict: SkillCheckConflict<SkillCheck>) {
        void setActionParams(
            (current) =>
                current.action === "resolve" &&
                current.personId === conflict.assesseeId &&
                current.skillId === conflict.skillId
                    ? { action: null, personId: null, skillId: null }
                    : {},
            { history: "replace" },
        );
    }

    // A pasted `?action=approve` on an approved session or a blocked draft (or `?action=reopen`
    // on a draft, `?action=resolve` for a conflict that doesn't exist, or a check dialog for a
    // person or skill with no checks here), or a session whose status changed while one was open:
    // clear the params, replacing the history entry. `open` is masked until they're gone.
    const staleAction =
        (action === "approve" && !canOpenApprove) ||
        (action === "reopen" && !canOpenReopen) ||
        (action === "resolve" && !canOpenResolve) ||
        (action === "review-person" && !reviewingPerson) ||
        (action === "review-skill" && !reviewingSkill)
            ? action
            : null;
    useEffect(() => {
        if (staleAction) closeAction(staleAction);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `closeAction` is rebuilt every render
    }, [staleAction]);

    // The check dialog's subject and its checks, each labelled with the other side's name and
    // sorted by it.
    const personName = (id: SkillCheck["assesseeId"]) => assesseeById.get(id)?.name ?? id;
    const skillName = (id: SkillCheck["skillId"]) => skillById.get(id)?.name ?? id;
    const review = reviewingPerson
        ? {
              action: "review-person" as const,
              subject: { kind: "person", id: reviewingPerson.id } as const,
              title: personName(reviewingPerson.id),
              description: coverageSummary(reviewingPerson, "skills"),
              rows: reviewingPerson.checks.map((check) => ({
                  check,
                  label: skillName(check.skillId),
              })),
          }
        : reviewingSkill
          ? {
                action: "review-skill" as const,
                subject: { kind: "skill", id: reviewingSkill.id } as const,
                title: skillName(reviewingSkill.id),
                description: coverageSummary(reviewingSkill, "personnel"),
                rows: reviewingSkill.checks.map((check) => ({
                    check,
                    label: personName(check.assesseeId),
                })),
            }
          : null;
    const reviewRows = review?.rows.toSorted((a, b) => a.label.localeCompare(b.label)) ?? [];

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
                                    excludedCount={excludedCount}
                                    open={canOpenApprove && action === "approve"}
                                    onOpenChange={(open) =>
                                        open ? openAction("approve") : closeAction("approve")
                                    }
                                />
                            </Protect>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                        <span className="sr-only">View options</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-60" align="end">
                                    <DropdownMenuLabel>Include</DropdownMenuLabel>
                                    <DropdownMenuCheckboxItem
                                        checked={includeUnassessedPeople}
                                        onCheckedChange={(checked) =>
                                            void setIncludeUnassessedPeople(checked)
                                        }
                                    >
                                        Unassessed personnel
                                    </DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem
                                        checked={includeUnassessedSkills}
                                        onCheckedChange={(checked) =>
                                            void setIncludeUnassessedSkills(checked)
                                        }
                                    >
                                        Unassessed skills
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                                            To change what&apos;s included, reopen it with Reopen at
                                            the top of the page.
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
                                uniqueCheckCount={uniqueCheckCount}
                                personnelCount={assessedPeople.size}
                                skillCount={assessedSkills.size}
                                coveragePercent={coveragePercent}
                            />
                            <Show when={conflicts.length > 0}>
                                <SkillTrack_SessionReview_Conflicts
                                    id="conflicts"
                                    conflicts={conflicts}
                                    onResolve={openResolve}
                                    assesseeById={assesseeById}
                                    skillById={skillById}
                                    assessorById={assessorById}
                                    isApproved={isApproved}
                                />
                            </Show>
                            <SkillTrack_SessionReview_Coverage
                                id="coverage"
                                people={peopleCoverage}
                                skills={skillsCoverage}
                                peopleCount={assessees.length}
                                skillsCount={sessionSkills.length}
                                assesseeById={assesseeById}
                                skillById={skillById}
                                conflictCheckIds={conflictCheckIds}
                                onOpen={openReview}
                            />
                        </Show>
                        {review && (
                            <SkillsModule_ReviewChecks_Dialog
                                sessionId={sessionId}
                                subject={review.subject}
                                title={review.title}
                                description={review.description}
                                rows={reviewRows}
                                assessorById={assessorById}
                                conflictCheckIds={conflictCheckIds}
                                readOnly={reviewReadOnly}
                                open={action === review.action}
                                onOpenChange={(open) =>
                                    open ? undefined : closeAction(review.action)
                                }
                                onSaved={closeReviewedChecks}
                            />
                        )}
                        {resolvingConflict && (
                            <SkillsModule_ResolveConflict_Dialog
                                sessionId={sessionId}
                                conflict={resolvingConflict}
                                assesseeName={
                                    assesseeById.get(resolvingConflict.checks[0].assesseeId)
                                        ?.name ?? resolvingConflict.assesseeId
                                }
                                skillName={
                                    skillById.get(resolvingConflict.checks[0].skillId)?.name ??
                                    resolvingConflict.skillId
                                }
                                assessorById={assessorById}
                                open={canOpenResolve && action === "resolve"}
                                onOpenChange={(open) => (open ? undefined : closeAction("resolve"))}
                                onResolved={closeResolvedConflict}
                            />
                        )}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
