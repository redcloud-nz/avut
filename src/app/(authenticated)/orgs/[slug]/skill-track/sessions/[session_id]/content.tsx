/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
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
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { formatDate } from "@/lib/datetime";
import { PersonRef } from "@/lib/schemas/person";
import { route } from "@/lib/routes";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";

export function SkillTrack_Session_Content({
    slug,
    session,
}: {
    slug: string;
    session: SkillCheckSession & { assessors: PersonRef[] };
}) {
    return (
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
                                <DropdownMenuItem asChild>
                                    <Link
                                        href={route(
                                            "/orgs/[slug]/skill-track/sessions/[session_id]/by-person",
                                            { slug, session_id: session.id },
                                        )}
                                    >
                                        By Person
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link
                                        href={route(
                                            "/orgs/[slug]/skill-track/sessions/[session_id]/by-skill",
                                            { slug, session_id: session.id },
                                        )}
                                    >
                                        By Skill
                                    </Link>
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" asChild>
                        <Link
                            href={route("/orgs/[slug]/skill-track/sessions/[session_id]/review", {
                                slug,
                                session_id: session.id,
                            })}
                        >
                            Review
                        </Link>
                    </Button>
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
                            <DL>
                                <DLTerm>Session ID</DLTerm>
                                <DLDetails className="font-mono">{session.id}</DLDetails>

                                <DLTerm>Name</DLTerm>
                                <DLDetails>{session.name}</DLDetails>

                                <DLTerm>Date</DLTerm>
                                <DLDetails>{formatDate(session.date)}</DLDetails>

                                <DLTerm>Notes</DLTerm>
                                <DLDetails>{session.notes}</DLDetails>

                                <DLTerm>Status</DLTerm>
                                <DLDetails>{session.status}</DLDetails>

                                <DLTerm>Assessor</DLTerm>
                                <DLDetails>
                                    {session.assessors.map((a) => a.name).join(", ") || "—"}
                                </DLDetails>
                            </DL>
                        </CardContent>
                    </Card>
                </Saratoga.Column>
                <Saratoga.Column slot="secondary">
                    <Suspense fallback={<CardLoadingFallback />}>
                        <SkillsModule_Session_Contents_Card sessionId={session.id} />
                    </Suspense>
                    <Card>
                        <CardContent>
                            <DL>
                                <DLTerm>Created</DLTerm>
                                <DLDateDetails date={session.createdAt} />
                                <DLTerm>Updated</DLTerm>
                                <DLDateDetails date={session.updatedAt} />
                            </DL>
                        </CardContent>
                    </Card>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
