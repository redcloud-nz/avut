/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /main/[slug]/skills/sessions/[session_id]
 */

"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/items";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";
import { Protect } from "@/components/protect";
import { Separator } from "@/components/ui/separator";

export default function SkillsModule_Session_Page(
    props: PageProps<"/main/[slug]/skills/sessions/[session_id]">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const { data: session } = useSuspenseQuery(
        trpc.skills.getSession.queryOptions({
            organizationId: organization.id,
            skillCheckSessionId: session_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Skills", href: route("/main/[slug]/skills", { slug }) },
                    { label: "Sessions", href: route("/main/[slug]/skills/sessions", { slug }) },
                    session.name || session.id,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="sm">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/skills/sessions", { slug })}
                            tooltip="Back to sessions list"
                        />
                        <Hermes.Title>{session.name}</Hermes.Title>
                    </Hermes.Header>

                    <ItemGroup>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/skills/sessions/[session_id]/details", {
                                    slug,
                                    session_id,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>Details</ItemTitle>
                                    <ItemDescription>View and edit session details</ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/skills/sessions/[session_id]/personnel", {
                                    slug,
                                    session_id,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>Personnel</ItemTitle>
                                    <ItemDescription>
                                        Manage the personnel assigned to this session
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/skills/sessions/[session_id]/skills", {
                                    slug,
                                    session_id,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>Skills</ItemTitle>
                                    <ItemDescription>
                                        Manage the skills assigned to this session
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Separator />
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/skills/sessions/[session_id]/by-person", {
                                    slug,
                                    session_id,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>Assess By Person</ItemTitle>
                                    <ItemDescription>
                                        Record skill checks for a person across all skills assigned
                                        to the session
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>
                        <Item asChild>
                            <Link
                                href={route("/main/[slug]/skills/sessions/[session_id]/by-skill", {
                                    slug,
                                    session_id,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>Assess By Skill</ItemTitle>
                                    <ItemDescription>
                                        Record skill checks for a skill across all personnel
                                        assigned to the session
                                    </ItemDescription>
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon className="size-4" />
                                </ItemActions>
                            </Link>
                        </Item>

                        <Protect
                            orgId={organization.id}
                            permissions={{ skillCheckSession: ["update"] }}
                        >
                            <Separator />
                            <Item asChild>
                                <Link
                                    href={route(
                                        "/main/[slug]/skills/sessions/[session_id]/review",
                                        {
                                            slug,
                                            session_id,
                                        },
                                    )}
                                >
                                    <ItemContent>
                                        <ItemTitle>Review</ItemTitle>
                                        <ItemDescription>
                                            Review and approve the skill checks recorded in this
                                            session
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        <ChevronRightIcon className="size-4" />
                                    </ItemActions>
                                </Link>
                            </Item>
                        </Protect>
                    </ItemGroup>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
