/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

export function SkillsModule_Session_Contents_Card({
    sessionId,
}: {
    sessionId: SkillCheckSessionId;
}) {
    const organization = useOrganization();

    const [{ data: skillChecks }, { data: assessees }, { data: skills }] = useSuspenseQueries({
        queries: [
            trpc.skillChecks.listSkillChecks.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
            }),
            trpc.skills.listSessionAssessees.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "assigned",
            }),
            trpc.skills.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: sessionId,
                scope: "assigned",
            }),
        ],
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Contents</CardTitle>
            </CardHeader>

            <CardContent className="px-2 -my-2">
                <Item size="sm" asChild>
                    <Link
                        href={route("/orgs/[slug]/skill-track/sessions/[session_id]/personnel", {
                            slug: organization.slug,
                            session_id: sessionId,
                        })}
                    >
                        <ItemContent>
                            <ItemTitle>{assessees.length} Personnel</ItemTitle>
                            <ItemDescription>assigned to the session</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <ChevronRightIcon className="size-4" />
                        </ItemActions>
                    </Link>
                </Item>
                <Item size="sm" asChild>
                    <Link
                        href={route("/orgs/[slug]/skill-track/sessions/[session_id]/skills", {
                            slug: organization.slug,
                            session_id: sessionId,
                        })}
                    >
                        <ItemContent>
                            <ItemTitle>{skills.length} Skills</ItemTitle>
                            <ItemDescription>assigned to the session</ItemDescription>
                        </ItemContent>
                        <ItemActions>
                            <ChevronRightIcon className="size-4" />
                        </ItemActions>
                    </Link>
                </Item>
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
            </CardContent>
        </Card>
    );
}
