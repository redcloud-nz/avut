/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]
 */

"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Lexington } from "@/components/blocks/lexington";
import { Saratoga } from "@/components/blocks/saratoga";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate, formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { SkillsModule_SessionMenu } from "./session-menu";

export default function SkillsModule_Session_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const [{ data: session }, { data: skillChecks }, { data: assessees }, { data: skills }] =
        useSuspenseQueries({
            queries: [
                trpc.skills.getSession.queryOptions({
                    organizationId: organization.id,
                    skillCheckSessionId: session_id,
                }),
                trpc.skillChecks.listSkillChecks.queryOptions({
                    organizationId: organization.id,
                    sessionId: session_id,
                }),
                trpc.skills.listSessionAssessees.queryOptions({
                    organizationId: organization.id,
                    sessionId: session_id,
                    scope: "assigned",
                }),
                trpc.skills.listSessionSkills.queryOptions({
                    organizationId: organization.id,
                    sessionId: session_id,
                    scope: "assigned",
                }),
            ],
        });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    session.name || session.id,
                ]}
            />
            <Lexington.Page className="p-4">
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
                                                    "/main/[slug]/skills/sessions/[session_id]/by-person",
                                                    {
                                                        slug,
                                                        session_id,
                                                    },
                                                )}
                                            >
                                                By Person
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <Link
                                                href={route(
                                                    "/main/[slug]/skills/sessions/[session_id]/by-skill",
                                                    {
                                                        slug,
                                                        session_id,
                                                    },
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
                                    href={route(
                                        "/main/[slug]/skills/sessions/[session_id]/review",
                                        {
                                            slug,
                                            session_id,
                                        },
                                    )}
                                >
                                    Review
                                </Link>
                            </Button>
                            <SkillsModule_SessionMenu session={session} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Main>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Session Details</CardTitle>
                                    <CardAction>
                                        <Button variant="ghost" size="icon">
                                            <ObjectIcons.Edit />
                                        </Button>
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
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Main>
                        <Saratoga.Secondary>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contents</CardTitle>
                                </CardHeader>

                                <CardContent className="px-2 -my-2">
                                    <Item size="sm" asChild>
                                        <Link
                                            href={route(
                                                "/main/[slug]/skills/sessions/[session_id]/personnel",
                                                {
                                                    slug,
                                                    session_id,
                                                },
                                            )}
                                        >
                                            <ItemContent>
                                                <ItemTitle>{assessees.length} Personnel</ItemTitle>
                                                <ItemDescription>
                                                    assigned to the session
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon className="size-4" />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                    <Item size="sm" asChild>
                                        <Link
                                            href={route(
                                                "/main/[slug]/skills/sessions/[session_id]/skills",
                                                {
                                                    slug,
                                                    session_id,
                                                },
                                            )}
                                        >
                                            <ItemContent>
                                                <ItemTitle>{skills.length} Skills</ItemTitle>
                                                <ItemDescription>
                                                    assigned to the session
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon className="size-4" />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                    <Item size="sm" asChild>
                                        <Link
                                            href={route(
                                                "/main/[slug]/skills/sessions/[session_id]/skills",
                                                {
                                                    slug,
                                                    session_id,
                                                },
                                            )}
                                        >
                                            <ItemContent>
                                                <ItemTitle>
                                                    {skillChecks.length} Skill checks
                                                </ItemTitle>
                                                <ItemDescription>
                                                    recorded in the session
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon className="size-4" />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(session.createdAt)}</div>

                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(session.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(session.updatedAt)}</div>

                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(session.updatedAt)}
                                            </div>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Secondary>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Lexington.Page>
        </Lexington.Root>
    );
}
