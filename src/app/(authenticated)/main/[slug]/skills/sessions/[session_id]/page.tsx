/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]
 */

"use client";

import {
    CheckIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ClipboardCheckIcon,
    PocketKnifeIcon,
    UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemMedia,
    ItemTitle,
} from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";
import { Protect } from "@/components/protect";
import { Separator } from "@/components/ui/separator";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import {
    Table,
    TableBody,
    TableCell,
    TableHeadCell,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { SkillsModule_SessionMenu } from "./session-menu";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

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
                <div className="w-full max-w-5xl space-y-2">
                    <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                        <div>
                            <div className="scroll-m-20 text-xl font-semibold tracking-tight">
                                {session.name}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
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
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
                        <div className="">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Session Details</CardTitle>
                                    <CardAction>
                                        <Button variant="ghost" size="icon">
                                            <ObjectIcons.Edit />
                                        </Button>
                                        {/* <SkillsModule_SessionMenu session={session} /> */}
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
                        </div>
                        <div className="space-y-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Contents</CardTitle>
                                </CardHeader>

                                <CardContent className="px-2">
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
                                        <DLDetails>{formatDateTime(session.createdAt)}</DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>{formatDateTime(session.updatedAt)}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </Lexington.Page>
        </Lexington.Root>
    );
}
