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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { getSkillCheckResultLabel, SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
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
        { data: skillChecks, isFetching: isFetchingChecks },
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

    const skillById = useMemo(() => new Map(sessionSkills.map((s) => [s.id, s])), [sessionSkills]);

    const assessorById = useMemo(() => new Map(assessors.map((p) => [p.id, p])), [assessors]);

    // An approved session is locked until it's reopened: its checkboxes are read-only and show
    // the approval itself (`Include` checks), not `selected` (see `AssesseeChecks`).
    const isApproved = session.status === "Include";
    // Right after an approval `getSession` flips to `Include` before `listSkillChecks` has
    // refetched the stamped statuses, so until it has, keep showing `selected` (what was just
    // approved) rather than the stale pre-approval statuses, which would read as all unticked.
    const showApproval = isApproved && !isFetchingChecks;

    // The editable view's selection. Preselect everything not explicitly excluded: new `Draft`
    // checks and the `Pending` ones a reopen left behind (the previous approval's selection), so
    // re-approving starts from where the last approval left off. The page stays mounted across
    // approve → reopen, so a check that arrives in a later `skillChecks` (recorded, or re-recorded
    // over a tombstone, after mount) is preselected the same way; a check already listed keeps
    // whatever the user made of it, so their unticks survive a refetch.
    const [selected, setSelected] = useState<Set<SkillCheckId>>(
        () => new Set(skillChecks.filter((c) => c.status !== "Exclude").map((c) => c.id)),
    );
    const [prevSkillChecks, setPrevSkillChecks] = useState(skillChecks);
    if (skillChecks !== prevSkillChecks) {
        setPrevSkillChecks(skillChecks);
        const prevIds = new Set(prevSkillChecks.map((c) => c.id));
        const added = skillChecks
            .filter((c) => !prevIds.has(c.id) && c.status !== "Exclude")
            .map((c) => c.id);
        if (added.length > 0) setSelected((prev) => new Set([...prev, ...added]));
    }

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
                                                disabled={isApproved}
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
    /** True while the session is approved: the checkboxes are read-only. */
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
    disabled,
    showApproval,
    toggleCheck,
    toggleGroup,
}: AssesseeChecksProps) {
    const organization = useOrganization();
    const isChecked = (check: SkillCheck) =>
        showApproval ? check.status === "Include" : selected.has(check.id);
    const selectedCount = assesseeChecks.filter(isChecked).length;

    const hasChecks = assesseeChecks.length > 0;

    return (
        <>
            <TableRow>
                <TableCell>
                    {hasChecks && (
                        <Checkbox
                            id={`select-all-${assessee.id}`}
                            checked={
                                selectedCount == assesseeChecks.length
                                    ? true
                                    : selectedCount === 0
                                      ? false
                                      : "indeterminate"
                            }
                            disabled={disabled}
                            onCheckedChange={() =>
                                toggleGroup(assesseeChecks.map((check) => check.id))
                            }
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
                                disabled={disabled}
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
