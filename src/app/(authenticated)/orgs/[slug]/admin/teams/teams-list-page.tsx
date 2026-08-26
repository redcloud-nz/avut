/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import Link from "next/link";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { route } from "@/lib/routes";

import { AdminModule_TeamsList } from "@/components/admin/teams/teams-list";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

/**
 * Shared shell for `/orgs/[slug]/admin/teams` — used as-is by that route, and reused by
 * `/orgs/[slug]/admin/teams/--create` (the non-intercepted fallback for the create dialog)
 * so a direct load or refresh of the `--create` URL renders the same list underneath the
 * dialog overlay, not a bare form page.
 */
export async function TeamsListPage({ slug }: { slug: string }) {
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
        </HydrateClient>
    );
}
