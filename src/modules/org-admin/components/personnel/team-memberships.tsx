/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { PersonRef } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_Person_TeamMemberships_Card({ person }: { person: PersonRef }) {
    const organization = useOrganization();
    const headingId = useId();

    const [, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-membership"] as const),
    );

    const { data: teamMemberships } = useSuspenseQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            personId: person.id,
        }),
    );

    const memberships = [...teamMemberships].sort((a, b) => a.team.name.localeCompare(b.team.name));

    return (
        <section aria-labelledby={headingId} className="space-y-2">
            <div className="flex min-h-8 items-center justify-between gap-2 pl-1">
                <h2 id={headingId} className="text-base font-medium">
                    Team Memberships
                </h2>
                <Protect permissions={{ team: ["update"] }}>
                    <Button
                        variant="outline"
                        aria-label="Add to team"
                        onClick={() => setAction("add-membership", { history: "push" })}
                    >
                        <ObjectIcons.Create /> <span className="sr-only md:not-sr-only">Add</span>
                    </Button>
                </Protect>
            </div>
            {memberships.length === 0 ? (
                <p className="text-muted-foreground pl-1 text-sm">Not a member of any team.</p>
            ) : (
                <ItemGroup className="gap-2">
                    {memberships.map((membership) => (
                        <Item key={membership.teamId} variant="outline" role="listitem" asChild>
                            <Link
                                href={route(
                                    "/orgs/[slug]/admin/teams/[team_id]/members/[person_id]",
                                    {
                                        slug: organization.slug,
                                        team_id: membership.teamId,
                                        person_id: person.id,
                                    },
                                )}
                            >
                                <ItemContent>
                                    <ItemTitle>{membership.team.name}</ItemTitle>
                                    {membership.d4h && (
                                        <ItemDescription>
                                            {formatD4HMemberStatus(membership.d4h.d4hStatus)}
                                            {membership.d4h.d4hPosition
                                                ? ` · ${membership.d4h.d4hPosition}`
                                                : ""}
                                        </ItemDescription>
                                    )}
                                </ItemContent>
                                <ItemActions>
                                    <ChevronRightIcon
                                        aria-hidden
                                        className="text-muted-foreground size-4"
                                    />
                                </ItemActions>
                            </Link>
                        </Item>
                    ))}
                </ItemGroup>
            )}
        </section>
    );
}
