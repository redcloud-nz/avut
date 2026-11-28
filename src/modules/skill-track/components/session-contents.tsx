/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { findConflicts, isConflictResolved } from "@/lib/skill-check-conflicts";
import {
    useSessionConfigAction,
    type SessionConfigAction,
} from "@/modules/skill-track/components/session-config-dialogs";
import { useSessionAccess } from "@/modules/skill-track/lib/use-session-access";
import { trpc } from "@/trpc/client";

export function SkillsModule_Session_Contents_Card({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();
    const scopedRoute = useScopedRoute();

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

    // An approved session's config is locked until it's reopened, and a foreign one's (in team
    // scope) can't be changed here.
    const isApproved = session.status === "Include";
    const { locked } = useSessionAccess(session);

    // Only unresolved conflicts need attention, and only before approval; once approved, each one
    // has been resolved.
    const conflictCount = isApproved
        ? 0
        : findConflicts(skillChecks).filter((conflict) => !isConflictResolved(conflict)).length;

    return (
        <section aria-label="Contents">
            <ItemGroup className="gap-2">
                <ConfigRow
                    action="change-personnel"
                    locked={locked}
                    title={`${assessees.length} Personnel`}
                />
                <ConfigRow
                    action="change-skills"
                    locked={locked}
                    title={`${skills.length} Skills`}
                />
                <ConfigRow
                    action="change-assessors"
                    locked={locked}
                    title={`${session.assessors.length} Assessors`}
                />
                <Item variant="outline" role="listitem" asChild>
                    <Link
                        href={scopedRoute(
                            {
                                organization:
                                    "/orgs/[slug]/skill-track/sessions/[session_id]/checks",
                                team: "/teams/[slug]/skill-track/sessions/[session_id]/checks",
                            },
                            { session_id: sessionId },
                        )}
                    >
                        <ItemContent>
                            <ItemTitle>{skillChecks.length} Skill checks</ItemTitle>
                            <ItemDescription>recorded in the session</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <ChevronRightIcon className="text-muted-foreground size-4" />
                        </ItemActions>
                    </Link>
                </Item>
                {conflictCount > 0 && (
                    <Item variant="outline" role="listitem" asChild>
                        <Link
                            href={`${scopedRoute(
                                {
                                    organization:
                                        "/orgs/[slug]/skill-track/sessions/[session_id]/review",
                                    team: "/teams/[slug]/skill-track/sessions/[session_id]/review",
                                },
                                { session_id: sessionId },
                            )}#conflicts`}
                        >
                            <ItemContent>
                                <ItemTitle>
                                    {conflictCount} {conflictCount === 1 ? "Conflict" : "Conflicts"}
                                </ItemTitle>
                                <ItemDescription>
                                    {conflictCount === 1 ? "needs resolving" : "need resolving"}
                                </ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ChevronRightIcon className="text-muted-foreground size-4" />
                            </ItemActions>
                        </Link>
                    </Item>
                )}
            </ItemGroup>
        </section>
    );
}

/**
 * A Contents row for one of the session's config lists. Updaters get a button that opens the
 * list's dialog (hosted by `SkillTrack_SessionConfigDialogs` on the page); everyone else, and
 * everyone while the session is `locked` (approved, or foreign in team scope), gets the same row as plain text.
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
                    <Item
                        variant="outline"
                        role="listitem"
                        asChild
                        className="cursor-pointer text-left"
                    >
                        <button type="button" aria-haspopup="dialog" onClick={() => open(action)}>
                            {content}
                            <ItemActions>
                                <ChevronRightIcon className="text-muted-foreground size-4" />
                            </ItemActions>
                        </button>
                    </Item>
                ) : (
                    <Item variant="outline" role="listitem">
                        {content}
                    </Item>
                )
            }
        />
    );
}
