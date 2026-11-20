/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

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
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * The teams a user has been granted access to, as a headed list of tiles on the page background,
 * each linking to its team. Read-only (no Add): grants are managed from each team's page.
 */
export function AdminModule_UserTeams_Card({ userId }: { userId: UserId }) {
    const organization = useOrganization();
    const headingId = useId();

    const { data: grants } = useSuspenseQuery(
        trpc.teamUsers.listUserTeams.queryOptions({ organizationId: organization.id, userId }),
    );

    return (
        <section aria-labelledby={headingId} className="space-y-2">
            <div className="flex min-h-8 items-center justify-between gap-2 pl-1">
                <h2 id={headingId} className="text-base font-medium">
                    Teams
                </h2>
            </div>
            {grants.length === 0 ? (
                <p className="text-muted-foreground pl-1 text-sm">No team access.</p>
            ) : (
                <ItemGroup className="gap-2">
                    {grants.map((grant) => (
                        <Item key={grant.id} variant="outline" role="listitem" asChild>
                            <Link
                                href={route("/orgs/[slug]/admin/teams/[team_id]", {
                                    slug: organization.slug,
                                    team_id: grant.team.id,
                                })}
                            >
                                <ItemContent>
                                    <ItemTitle>{grant.team.name}</ItemTitle>
                                    {grant.team.status !== "Active" && (
                                        <ItemDescription>{grant.team.status}</ItemDescription>
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
