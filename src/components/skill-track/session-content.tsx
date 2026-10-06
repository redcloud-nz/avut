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
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { SkillTrack_SessionConfigDialogs } from "@/components/skill-track/session-config-dialogs";
import { SkillsModule_Session_Contents_Card } from "@/components/skill-track/session-contents";
import { SkillsModule_SessionMenu } from "@/components/skill-track/session-menu";
import { SkillsModule_UpdateSession_Dialog } from "@/components/skill-track/update-session";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardLoadingFallback,
    CardTitle,
} from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import { SKILL_CHECK_STATUS_LABELS } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillTrack_Session_Content({ sessionId }: { sessionId: SkillCheckSessionId }) {
    const organization = useOrganization();
    const { formatDate } = usePreferences();

    const { data: session } = useSuspenseQuery(
        trpc.skillCheckSessions.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: sessionId,
        }),
    );
    const isApproved = session.status === "Include";

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
                    { label: session.name || session.id },
                ]}
                actions={<HelpButton id="skill-track/sessions" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{session.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        Record <ChevronDownIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-40" align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Record skill checks</DropdownMenuLabel>
                                        {/* An approved session's checks are locked until it's
                                            reopened, so the entry pages have nothing to record. */}
                                        {isApproved ? (
                                            <>
                                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                                    Locked while the session is approved
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem disabled>
                                                    By Person
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    By Skill
                                                </DropdownMenuItem>
                                            </>
                                        ) : (
                                            <>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={route(
                                                            "/orgs/[slug]/skill-track/sessions/[session_id]/by-person",
                                                            {
                                                                slug: organization.slug,
                                                                session_id: session.id,
                                                            },
                                                        )}
                                                    >
                                                        By Person
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={route(
                                                            "/orgs/[slug]/skill-track/sessions/[session_id]/by-skill",
                                                            {
                                                                slug: organization.slug,
                                                                session_id: session.id,
                                                            },
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
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Session Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ skillCheckSession: ["update"] }}>
                                            <SkillsModule_UpdateSession_Dialog session={session} />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Session ID</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {session.id}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{session.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Date</DataItemTitle>
                                            <DataItemValue>
                                                {formatDate(session.date)}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Notes</DataItemTitle>
                                            <DataItemValue>{session.notes}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>
                                                {SKILL_CHECK_STATUS_LABELS[session.status] ??
                                                    session.status}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Suspense fallback={<CardLoadingFallback />}>
                                <SkillsModule_Session_Contents_Card sessionId={session.id} />
                            </Suspense>
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={session.createdAt} />
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Updated</DataItemTitle>
                                            <DataItemDateValue date={session.updatedAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
            <SkillTrack_SessionConfigDialogs sessionId={session.id} />
        </>
    );
}
