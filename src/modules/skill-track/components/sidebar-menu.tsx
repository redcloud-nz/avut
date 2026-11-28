/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";
import { Protect } from "@/components/protect";
import { useCurrentScope } from "@/hooks/use-current-scope";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { route } from "@/lib/routes";

/**
 * Nested pages for the Skill Track module's `NavCollapsible` section — not a standalone sidebar
 * group. Serves the org and team scopes; Assessors exist only in the org scope.
 */
export function SkillTrack_Sidebar_Menu() {
    const scopedRoute = useScopedRoute();
    const current = useCurrentScope();

    return (
        <>
            {current?.scope === "organization" && (
                <Protect permissions={{ roleGrant: ["skills-assessor"] }}>
                    <NavSubItem
                        label="Assessors"
                        href={route("/orgs/[slug]/skill-track/assessors", { slug: current.slug })}
                    />
                </Protect>
            )}
            <NavSubItem
                label="Packages"
                href={scopedRoute(
                    {
                        organization: "/orgs/[slug]/skill-track/packages",
                        team: "/teams/[slug]/skill-track/packages",
                    },
                    {},
                )}
            />
            <NavSubItem
                label="Skills"
                href={scopedRoute(
                    {
                        organization: "/orgs/[slug]/skill-track/skills",
                        team: "/teams/[slug]/skill-track/skills",
                    },
                    {},
                )}
            />
            <NavSubItem
                label="Checks"
                href={scopedRoute(
                    {
                        organization: "/orgs/[slug]/skill-track/checks",
                        team: "/teams/[slug]/skill-track/checks",
                    },
                    {},
                )}
            />
            <NavSubItem
                label="Sessions"
                href={scopedRoute(
                    {
                        organization: "/orgs/[slug]/skill-track/sessions",
                        team: "/teams/[slug]/skill-track/sessions",
                    },
                    {},
                )}
            />
            <NavSubItem
                label="Reports"
                href={scopedRoute(
                    {
                        organization: "/orgs/[slug]/skill-track/reports",
                        team: "/teams/[slug]/skill-track/reports",
                    },
                    {},
                )}
            />
        </>
    );
}
