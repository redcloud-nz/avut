/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { Teams_D4HCard } from "@/components/teams/d4h-link-card";
import { Teams_TeamAccess_Card } from "@/components/teams/team-access-card";
import { Teams_Details_Card } from "@/components/teams/team-details-card";
import { useOrganization } from "@/hooks/use-organization";
import { useTeam, useTeamSlug } from "@/hooks/use-team";
import { route } from "@/lib/routes";
import type { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { TeamAdmin_MembersLink_Card } from "./members-link-card";
import { TeamAdmin_Team_Menu } from "./team-menu";

/**
 * Team admin's overview (`/teams/[slug]/admin`): the team's details, access grants and D4H link,
 * written through the org procedures with the team's ids.
 *
 * The team is read through `teams.getTeam`, so the mutation effects refresh this page. The team
 * layout's snapshot (`useTeam()`, the sidebar and the window title) only updates on
 * `router.refresh()`, which the handlers below call after a write that changes the team.
 */
export function TeamAdmin_Overview_Content() {
    const router = useRouter();
    const organization = useOrganization();
    const teamSlug = useTeamSlug();
    const { id: teamId } = useTeam();

    const [, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));

    const { data: team } = useSuspenseQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    async function handleUpdated(updated: TeamData) {
        if (updated.slug && updated.slug !== teamSlug) {
            // Navigating drops `?action=update`, so there's no param to clear first.
            router.replace(route("/teams/[slug]/admin", { slug: updated.slug }));
            return;
        }
        // Await the param clear before refreshing: a refresh that lands first would render
        // with `?action=update` still in the URL and reopen the dialog.
        await setAction(null, { history: "replace" });
        router.refresh();
    }

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: team.name, href: route("/teams/[slug]", { slug: teamSlug }) },
                    "Admin",
                ]}
                actions={<HelpButton id="team-admin" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Team Admin</Saratoga.Title>
                        <Saratoga.Actions>
                            <TeamAdmin_Team_Menu team={team} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Teams_Details_Card
                                team={team}
                                requireSlug
                                onUpdated={(updated) => void handleUpdated(updated)}
                            />

                            <Protect permissions={{ member: ["view"] }}>
                                <Teams_TeamAccess_Card
                                    team={team}
                                    linkPeople={false}
                                    onSelfRevoked={() => router.replace("/user")}
                                />
                            </Protect>

                            <Teams_D4HCard team={team} onChanged={() => router.refresh()} />
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <TeamAdmin_MembersLink_Card teamId={team.id} />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
