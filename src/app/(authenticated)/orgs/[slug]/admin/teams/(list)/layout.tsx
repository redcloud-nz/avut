/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/teams
 *
 * Renders the teams list. `(list)` is a plain route group — it adds no path segment, so
 * this layout applies to `/orgs/[slug]/admin/teams` and `.../teams/--create` (both nested
 * under it) but not to `.../teams/[team_id]` (a sibling of `(list)`, outside the group).
 *
 * `--create/page.tsx` renders as `children` here alongside the list rather than replacing
 * it, so navigating between `/teams` and `/teams/--create` never remounts this layout: the
 * list stays mounted (no refetch) and the create dialog just appears on top of it — on a
 * client-side navigation *and* on a direct load/refresh, since both go through this same
 * layout + page composition.
 */

import Link from "next/link";
import { ReactNode } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { route } from "@/lib/routes";

import { AdminModule_TeamsList } from "@/components/admin/teams/teams-list";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function TeamsListLayout(props: {
    params: Promise<{ slug: string }>;
    children: ReactNode;
}) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);

    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                        { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug }) },
                    ]}
                />
                <Std.ScrollContainer>
                    <Saratoga.Root>
                        <Saratoga.Header>
                            <Saratoga.Title>Teams</Saratoga.Title>
                            <Saratoga.Actions>
                                <Protect permissions={{ team: ["create"] }}>
                                    <Button variant="outline" asChild>
                                        <Link
                                            href={route("/orgs/[slug]/admin/teams/--create", {
                                                slug,
                                            })}
                                        >
                                            <ObjectIcons.Create />{" "}
                                            <span className="hidden md:inline">New Team</span>
                                        </Link>
                                    </Button>
                                </Protect>
                            </Saratoga.Actions>
                        </Saratoga.Header>

                        <AdminModule_TeamsList />
                    </Saratoga.Root>
                </Std.ScrollContainer>
            </Std.SidebarInset>
            {props.children}
        </HydrateClient>
    );
}
