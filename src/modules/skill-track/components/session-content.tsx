/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { TeamLink } from "@/components/entity-links/team-link";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { CardContent, CardLoadingFallback } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { SkillCheckSessionStatusBadge } from "@/components/ui/status-badge";
import { useOrganization } from "@/hooks/use-organization";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillTrack_ForeignSessionNotice } from "@/modules/skill-track/components/foreign-session-notice";
import { SkillTrack_SessionConfigDialogs } from "@/modules/skill-track/components/session-config-dialogs";
import { SkillsModule_Session_Contents_Card } from "@/modules/skill-track/components/session-contents";
import { SkillsModule_SessionMenu } from "@/modules/skill-track/components/session-menu";
import { SkillsModule_UpdateSession_Dialog } from "@/modules/skill-track/components/update-session";
import { useFormatSessionWhen } from "@/modules/skill-track/lib/use-format-session-when";
import { useSessionAccess } from "@/modules/skill-track/lib/use-session-access";
import { trpc } from "@/trpc/client";

export function SkillTrack_Session_Content({ sessionId }: { sessionId: SkillCheckSessionId }) {
    const organization = useOrganization();
    const scopedRoute = useScopedRoute();
    const formatSessionWhen = useFormatSessionWhen();

    const { data: session } = useSuspenseQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
        }),
    );
    // Locked while approved, and in team scope for another team's (or an org) session.
    const { foreign, locked } = useSessionAccess(session);

    return (
        <>
            <Saratoga.Root>
                <Saratoga.Breadcrumbs
                    items={[
                        {
                            label: "Skill Check Sessions",
                            href: scopedRoute(
                                {
                                    organization: "/orgs/[slug]/skill-track/sessions",
                                    team: "/teams/[slug]/skill-track/sessions",
                                },
                                {},
                            ),
                        },
                    ]}
                />
                <Saratoga.Header>
                    <Saratoga.Title
                        badges={<SkillCheckSessionStatusBadge status={session.status} />}
                    >
                        {session.name || session.id}
                    </Saratoga.Title>
                    <Saratoga.Actions>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    Record <ChevronDownIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Record skill checks</DropdownMenuLabel>
                                    {/* An approved session's checks are locked until it's
                                            reopened, and a foreign one's can't be changed here,
                                            so the entry pages have nothing to record. */}
                                    {locked ? (
                                        <>
                                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                                {foreign
                                                    ? "View only in this team"
                                                    : "Locked while the session is approved"}
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem disabled>By Person</DropdownMenuItem>
                                            <DropdownMenuItem disabled>By Skill</DropdownMenuItem>
                                        </>
                                    ) : (
                                        <>
                                            <DropdownMenuItem asChild>
                                                <Link
                                                    href={scopedRoute(
                                                        {
                                                            organization:
                                                                "/orgs/[slug]/skill-track/sessions/[session_id]/by-person",
                                                            team: "/teams/[slug]/skill-track/sessions/[session_id]/by-person",
                                                        },
                                                        { session_id: session.id },
                                                    )}
                                                >
                                                    By Person
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link
                                                    href={scopedRoute(
                                                        {
                                                            organization:
                                                                "/orgs/[slug]/skill-track/sessions/[session_id]/by-skill",
                                                            team: "/teams/[slug]/skill-track/sessions/[session_id]/by-skill",
                                                        },
                                                        { session_id: session.id },
                                                    )}
                                                >
                                                    By Skill
                                                </Link>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <SkillsModule_SessionMenu session={session} />
                    </Saratoga.Actions>
                </Saratoga.Header>
                {foreign && (
                    <SkillTrack_ForeignSessionNotice
                        team={session.team}
                        orgHref={route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                            slug: organization.slug,
                            session_id: session.id,
                        })}
                    />
                )}
                <Saratoga.Columns>
                    <Saratoga.Column slot="main">
                        <RecordCard
                            label="Session"
                            updatedAt={session.updatedAt}
                            historyHref={scopedRoute(
                                {
                                    organization:
                                        "/orgs/[slug]/skill-track/sessions/[session_id]/history",
                                    team: "/teams/[slug]/skill-track/sessions/[session_id]/history",
                                },
                                { session_id: session.id },
                            )}
                            action={
                                // Not mounted when locked (approved, or foreign in team scope), so
                                // ?action=update can't open it either: in team scope it would
                                // also move a foreign session to this team.
                                !locked && (
                                    <Protect permissions={{ skillCheckSession: ["update"] }}>
                                        <SkillsModule_UpdateSession_Dialog session={session} />
                                    </Protect>
                                )
                            }
                        >
                            <CardContent>
                                <DataList>
                                    <RecordCardId label="Session ID" id={session.id} />
                                    <DataItem>
                                        <DataItemTitle>Name</DataItemTitle>
                                        <DataItemValue>{session.name}</DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>When</DataItemTitle>
                                        <DataItemValue>
                                            {formatSessionWhen(session.startsAt, session.endsAt)}
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Team</DataItemTitle>
                                        <DataItemValue>
                                            {session.team ? <TeamLink team={session.team} /> : "—"}
                                        </DataItemValue>
                                    </DataItem>
                                    <DataItem>
                                        <DataItemTitle>Notes</DataItemTitle>
                                        <DataItemValue>{session.notes}</DataItemValue>
                                    </DataItem>
                                </DataList>
                            </CardContent>
                        </RecordCard>
                    </Saratoga.Column>
                    <Saratoga.Column slot="secondary">
                        <Suspense fallback={<CardLoadingFallback />}>
                            <SkillsModule_Session_Contents_Card sessionId={session.id} />
                        </Suspense>
                    </Saratoga.Column>
                </Saratoga.Columns>
            </Saratoga.Root>
            <SkillTrack_SessionConfigDialogs sessionId={session.id} />
        </>
    );
}
