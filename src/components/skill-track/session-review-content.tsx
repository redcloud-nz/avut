/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Show } from "@/components/show";
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

import { skillChecksWrites } from "@/client/skill-checks-writes";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { getSkillCheckResultLabel, SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
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
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
            }),
            trpc.skills.listSessionAssessees.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "all",
            }),
            trpc.skills.listSessionAssessors.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "all",
            }),
            trpc.skills.listSessionSkills.queryOptions({
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

    const [selected, setSelected] = useState<Set<SkillCheckId>>(
        () => new Set(skillChecks.filter((c) => c.status !== "Exclude").map((c) => c.id)),
    );

    const mutation = useMutation(
        trpc.skillChecks.approveSession.mutationOptions({
            meta: { writes: skillChecksWrites.approveSession },
            onError(error) {
                toast.error(`Failed to approve session: ${error.message}`);
            },
            onSuccess() {
                toast.success("Session approved.");
            },
        }),
    );

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
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Review</Saratoga.Title>
                    </Saratoga.Header>
                    <Show when={session.status === "Include"}>
                        <Alert>
                            <AlertTitle>Already approved</AlertTitle>
                            <AlertDescription>
                                This session has already been approved. You can update the selection
                                and re-approve.
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
                                    Select the skill checks you want to include in the session
                                    approval. Only the selected checks will be included in the
                                    session results. You can change the selection and re-approve as
                                    needed.
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
                                                toggleCheck={toggleCheck}
                                                toggleGroup={toggleGroup}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
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
    toggleCheck(id: SkillCheckId): void;
    toggleGroup(ids: SkillCheckId[]): void;
}

function AssesseeChecks({
    assessee,
    assesseeChecks,
    skillById,

    selected,
    toggleCheck,
    toggleGroup,
}: AssesseeChecksProps) {
    const organization = useOrganization();
    const selectedCount = assesseeChecks.filter((check) => selected.has(check.id)).length;

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
                                checked={selected.has(check.id)}
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
