/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ClipboardCheckIcon, ClipboardListIcon, PackageIcon, PocketKnifeIcon } from "lucide-react";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import { StatCard, StatCardGrid } from "@/components/ui/stat-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function Organization_Dashboard_SkillTrackStats() {
    const organization = useOrganization();
    const { slug } = organization;

    const [{ data: assessable }, { data: sessions }] = useSuspenseQueries({
        queries: [
            trpc.skills.listAssessableSkills.queryOptions({ organizationId: organization.id }),
            trpc.skills.listSessions.queryOptions({ organizationId: organization.id }),
        ],
    });

    return (
        <StatCardGrid>
            <StatCard
                label="Skill Packages"
                value={assessable.skillPackages.length}
                icon={PackageIcon}
                href={route("/orgs/[slug]/skill-track/catalogue", { slug })}
            />
            <StatCard
                label="Skills"
                value={assessable.skills.length}
                icon={PocketKnifeIcon}
                href={route("/orgs/[slug]/skill-track/catalogue", { slug })}
            />
            <StatCard
                label="Skill Check Sessions"
                value={sessions.length}
                icon={ClipboardListIcon}
                href={route("/orgs/[slug]/skill-track/sessions", { slug })}
            />
            <Protect permissions={{ skillCheck: ["view"] }}>
                <Organization_Dashboard_SkillChecksStat />
            </Protect>
        </StatCardGrid>
    );
}

function Organization_Dashboard_SkillChecksStat() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: skillChecks } = useSuspenseQuery(
        trpc.skillChecks.listSkillChecks.queryOptions({ organizationId: organization.id }),
    );

    return (
        <StatCard
            label="Skill Checks"
            value={skillChecks.length}
            icon={ClipboardCheckIcon}
            href={route("/orgs/[slug]/skill-track/checks", { slug })}
        />
    );
}
