/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon, LockOpenIcon } from "lucide-react";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { SkillsModule_ApproveSession_Dialog } from "@/components/skill-track/approve-session";
import { SkillsModule_ReopenSession_Dialog } from "@/components/skill-track/reopen-session";
import { SkillsModule_ResolveConflict_Dialog } from "@/components/skill-track/resolve-conflict";
import { SkillTrack_SessionReview_Conflicts } from "@/components/skill-track/session-review-conflicts";
import { SkillTrack_SessionReview_Coverage } from "@/components/skill-track/session-review-coverage";
import { SkillTrack_SessionReview_Summary } from "@/components/skill-track/session-review-summary";
import { useRefetchSessionOnConflict } from "@/components/skill-track/use-refetch-session-on-conflict";
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
import { SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
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

    // Each decision is saved as it's made: a check is included unless its status is `Exclude`
    // (`isCheckIncluded`), and Approve approves that saved state. Conflicts are resolved in the
    // Resolve dialog. Interim until the check dialogs save through Save: a click on a check's
    // checkbox saves straight away.
    const refetchSessionOnConflict = useRefetchSessionOnConflict(sessionId);
    const exclusions = useMutation(
        trpc.skillCheckSessions.updateCheckExclusions.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.updateCheckExclusions },
            onError(error) {
                console.error("Failed to save the review decision:", error);
                toast.error(`Failed to save: ${error.message}`);
                refetchSessionOnConflict(error);
            },
        }),
    );
    function saveExclusions(changes: { skillCheckId: SkillCheckId; excluded: boolean }[]) {
        exclusions.mutate({ organizationId: organization.id, sessionId, changes });
    }
    // Read-only while a save is in flight too, so a second click can't race the first's refetch.
    const controlsDisabled = isApproved || !canApprove || exclusions.isPending;

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
    const approveBlockedReason = exclusions.isPending
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
    // approval turns the session approved, which closes Approve here as a stale action.
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["reopen", "approve", "resolve"] as const),
    );
    const [personId, setPersonId] = useQueryState("personId", parseAsString);
    const [skillId, setSkillId] = useQueryState("skillId", parseAsString);
    const canOpenReopen = canApprove && isApproved;
    const canOpenApprove = canApprove && !isApproved && approveBlockedReason === null;
    const resolvingConflict =
        conflicts.find(
            (conflict) => conflict.assesseeId === personId && conflict.skillId === skillId,
        ) ?? null;
    const canOpenResolve = canApprove && !isApproved && resolvingConflict !== null;

    function openAction(next: "reopen" | "approve") {
        void setAction(next, { history: "push" });
    }
    function openResolve(conflict: SkillCheckConflict<SkillCheck>) {
        void setPersonId(conflict.assesseeId, { history: "push" });
        void setSkillId(conflict.skillId, { history: "push" });
        void setAction("resolve", { history: "push" });
    }
    function closeAction(only: "reopen" | "approve" | "resolve") {
        void setAction((current) => (current === only ? null : current), { history: "replace" });
        if (only === "resolve") {
            void setPersonId(null, { history: "replace" });
            void setSkillId(null, { history: "replace" });
        }
    }

    // A pasted `?action=approve` on an approved session or a blocked draft (or `?action=reopen`
    // on a draft, or `?action=resolve` for a conflict that doesn't exist), or a session whose
    // status changed while one was open: clear the params, replacing the history entry. `open` is
    // masked until they're gone.
    const staleAction =
        (action === "approve" && !canOpenApprove) ||
        (action === "reopen" && !canOpenReopen) ||
        (action === "resolve" && !canOpenResolve)
            ? action
            : null;
    useEffect(() => {
        if (staleAction) closeAction(staleAction);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `closeAction` is rebuilt every render
    }, [staleAction]);

    function toggleCheck(check: SkillCheck) {
        saveExclusions([{ skillCheckId: check.id, excluded: isCheckIncluded(check) }]);
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
                                assessorById={assessorById}
                                conflictCheckIds={conflictCheckIds}
                                disabled={controlsDisabled}
                                toggleCheck={toggleCheck}
                            />
                        </Show>
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
                            />
                        )}
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
