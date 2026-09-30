/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import {
    useSessionConfigAction,
    type SessionConfigAction,
} from "@/components/skill-track/session-config-dialogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { findConflicts } from "@/lib/skill-check-conflicts";
import { trpc } from "@/trpc/client";

export function SkillsModule_Session_Contents_Card({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();

    const [{ data: session }, { data: skillChecks }, { data: assessees }, { data: skills }] =
        useSuspenseQueries({
            queries: [
                trpc.skillCheckSessions.getSession.queryOptions({
                    organizationId: organization.id,
                    skillCheckSessionId: sessionId,
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

    // An approved session's config is locked until it's reopened.
    const isApproved = session.status === "Include";

    // Conflicts only need attention before approval; once approved, each one has been resolved.
    const conflictCount = isApproved ? 0 : findConflicts(skillChecks).length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Contents</CardTitle>
            </CardHeader>

            <CardContent className="px-2 -my-2">
                <ConfigRow
                    action="change-personnel"
                    locked={isApproved}
                    title={`${assessees.length} Personnel`}
                />
                <ConfigRow
                    action="change-skills"
                    locked={isApproved}
                    title={`${skills.length} Skills`}
                />
                <ConfigRow
                    action="change-assessors"
                    locked={isApproved}
                    title={`${session.assessors.length} Assessors`}
                />
                <Item size="sm" asChild>
                    <Link
                        href={route("/orgs/[slug]/skill-track/sessions/[session_id]/checks", {
                            slug: organization.slug,
                            session_id: sessionId,
                        })}
                    >
                        <ItemContent>
                            <ItemTitle>{skillChecks.length} Skill checks</ItemTitle>
                            <ItemDescription>recorded in the session</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <ChevronRightIcon className="size-4" />
                        </ItemActions>
                    </Link>
                </Item>
                {conflictCount > 0 && (
                    <Item size="sm" asChild>
                        <Link
                            href={route("/orgs/[slug]/skill-track/sessions/[session_id]/review", {
                                slug: organization.slug,
                                session_id: sessionId,
                            })}
                        >
                            <ItemMedia
                                variant="icon"
                                className="text-amber-600 dark:text-amber-400"
                            >
                                <TriangleAlertIcon />
                            </ItemMedia>
                            <ItemContent>
                                <ItemTitle>
                                    {conflictCount} unresolved{" "}
                                    {conflictCount === 1 ? "conflict" : "conflicts"}
                                </ItemTitle>
                                <ItemDescription>resolve before approving</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ChevronRightIcon className="size-4" />
                            </ItemActions>
                        </Link>
                    </Item>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * A Contents row for one of the session's config lists. Updaters get a button that opens the
 * list's dialog (hosted by `SkillTrack_SessionConfigDialogs` on the page); everyone else, and
 * everyone while the session is `locked` (approved), gets the same row as plain text.
 */
function ConfigRow({
    action,
    title,
    locked,
}: {
    action: SessionConfigAction;
    title: string;
    locked: boolean;
}) {
    const { open } = useSessionConfigAction();

    const content = (
        <ItemContent>
            <ItemTitle>{title}</ItemTitle>
            <ItemDescription>assigned to the session</ItemDescription>
        </ItemContent>
    );

    return (
        <Protect
            permissions={{ skillCheckSession: ["update"] }}
            render={(hasPermission) =>
                hasPermission && !locked ? (
                    <Item size="sm" asChild className="cursor-pointer text-left hover:bg-muted">
                        <button type="button" aria-haspopup="dialog" onClick={() => open(action)}>
                            {content}
                            <ItemActions>
                                <ChevronRightIcon className="size-4" />
                            </ItemActions>
                        </button>
                    </Item>
                ) : (
                    <Item size="sm">{content}</Item>
                )
            }
        />
    );
}
