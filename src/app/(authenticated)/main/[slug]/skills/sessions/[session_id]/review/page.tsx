/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]/review
 */

"use client";

import { ChevronDownIcon, ClipboardCheckIcon } from "lucide-react";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Show } from "@/components/show";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldSet,
} from "@/components/ui/field";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
import { trpc } from "@/trpc/client";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

const RESULT_LABELS: Record<string, string> = {
    NotAssessed: "Not Assessed",
    NotTaught: "Not Taught",
    NotYetCompetent: "Not Yet Competent",
    Competent: "Competent",
    HighlyConfident: "Highly Confident",
};

export default function SkillsModule_SessionReview_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]/review">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();
    const queryClient = useQueryClient();

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
                skillCheckSessionId: session_id,
            }),
            trpc.skills.listSessionAssessees.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
                scope: "all",
            }),
            trpc.skills.listSessionAssessors.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
                scope: "all",
            }),
            trpc.skills.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
                scope: "all",
            }),
            trpc.skillChecks.listSkillChecks.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
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
            onError(error) {
                toast.error(`Failed to approve session: ${error.message}`);
            },
            onSuccess({ updated }) {
                toast.success("Session approved.");

                queryClient.setQueryData(
                    trpc.skills.getSession.queryKey({
                        organizationId: organization.id,
                        skillCheckSessionId: session_id,
                    }),
                    updated,
                );
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
            sessionId: session_id,
            includedCheckIds: [...selected],
        });
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    {
                        label: session.name || session.id,
                        href: route("/main/[slug]/skills/sessions/[session_id]", {
                            slug,
                            session_id,
                        }),
                    },
                    "Review",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/skills/sessions/[session_id]", {
                                slug,
                                session_id,
                            })}
                        />
                        <Hermes.Title>Review</Hermes.Title>
                    </Hermes.Header>

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
                                <FieldSet>
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
                                    <Field orientation="horizontal">
                                        <MutationButton
                                            status={mutation.status}
                                            onClick={handleApprove}
                                            text={{
                                                idle: "Approve",
                                                pending: "Submitting...",
                                                success: "Submitted",
                                            }}
                                        />
                                    </Field>
                                </FieldSet>
                            </CardContent>
                        </Card>
                    </Show>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
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
    assessorById,
    selected,
    toggleCheck,
    toggleGroup,
}: AssesseeChecksProps) {
    const selectedCount = assesseeChecks.filter((check) => selected.has(check.id)).length;

    if (assesseeChecks.length === 0) {
        return (
            <div
                className="group w-full flex items-center px-2 py-1 justify-between border-b"
                key={assessee.id}
            >
                <div className="font-medium">{assessee.name}</div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span>No skill checks recorded</span>
                </div>
            </div>
        );
    }

    return (
        <Collapsible key={assessee.id}>
            <CollapsibleTrigger className="group w-full flex items-center px-2 py-1 justify-between transition-none hover:bg-accent hover:text-accent-foreground border-b">
                <div className="font-medium">{assessee.name}</div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 text-muted-foreground">
                        <span>
                            {selectedCount} of {assesseeChecks.length}
                        </span>
                        <span className="hidden md:inline">selected</span>
                    </div>
                    <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeadCell>
                                <Checkbox
                                    id={`select-all-${assessee.id}`}
                                    checked={selectedCount === assesseeChecks.length}
                                    onCheckedChange={() =>
                                        toggleGroup(assesseeChecks.map((check) => check.id))
                                    }
                                />
                            </TableHeadCell>
                            <TableHeadCell>Skill</TableHeadCell>
                            <TableHeadCell className="text-center">Result</TableHeadCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assesseeChecks.map((check) => {
                            const skill = skillById.get(check.skillId);
                            const assessor = assessorById.get(check.assessorId);
                            return (
                                <TableRow key={check.id}>
                                    <TableCell>
                                        <Checkbox
                                            id={`check-${check.id}`}
                                            checked={selected.has(check.id)}
                                            onCheckedChange={() => toggleCheck(check.id)}
                                        />
                                    </TableCell>
                                    <TableCell>{skill?.name ?? check.skillId}</TableCell>
                                    <TableCell className="text-center">
                                        {RESULT_LABELS[check.result] ?? check.result}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CollapsibleContent>
        </Collapsible>
    );
}
