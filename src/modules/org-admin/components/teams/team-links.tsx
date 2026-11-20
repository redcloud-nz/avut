/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";

import { useQuery } from "@tanstack/react-query";

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
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function AdminModule_TeamLinks_Card({ team }: { team: TeamData }) {
    const organization = useOrganization();
    const headingId = useId();

    const [, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-membership"] as const),
    );

    const teamMembersQuery = useQuery(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    return (
        <section aria-labelledby={headingId} className="space-y-2">
            <div className="flex min-h-8 items-center justify-between gap-2 pl-1">
                <h2 id={headingId} className="text-base font-medium">
                    Related
                </h2>
                {team.status === "Active" && (
                    <Protect permissions={{ team: ["update"] }}>
                        <Button
                            variant="outline"
                            aria-label="Add person"
                            onClick={() => setAction("add-membership", { history: "push" })}
                        >
                            <ObjectIcons.Create />{" "}
                            <span className="sr-only md:not-sr-only">Add</span>
                        </Button>
                    </Protect>
                )}
            </div>
            <ItemGroup className="gap-2">
                {teamMembersQuery.isLoading && <Skeleton className="h-16 w-full" />}
                {teamMembersQuery.data && (
                    <Item variant="outline" role="listitem" asChild>
                        <Link
                            href={route("/orgs/[slug]/admin/teams/[team_id]/members", {
                                slug: organization.slug,
                                team_id: team.id,
                            })}
                        >
                            <ItemContent>
                                <ItemTitle>{teamMembersQuery.data.length} Personnel</ItemTitle>
                                <ItemDescription>assigned to this team</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                                <ChevronRightIcon
                                    aria-hidden
                                    className="text-muted-foreground size-4"
                                />
                            </ItemActions>
                        </Link>
                    </Item>
                )}
            </ItemGroup>
        </section>
    );
}
